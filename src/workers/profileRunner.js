/
 * Profile Runner Worker
 * Processes opportunity profiles on schedule, fetching from enabled sources
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const logger = require('../utils/logger');
const { getAdapter, hasAdapter } = require('../adapters');
const { 
  upsertOpportunity, 
  createEvent, 
  scoreOpportunity,
  linkOpportunityToProfile 
} = require('../services/opportunityService');

const WORKER_ID = 'worker-' + uuidv4().slice(0, 8);
const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_RUN_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

function calculateNextRun(profile) {
  const intervalMs = profile.run_interval_minutes 
    ? profile.run_interval_minutes * 60 * 1000 
    : DEFAULT_RUN_INTERVAL_MS;
  
  return new Date(Date.now() + intervalMs);
}

async function getDueProfiles() {
  const lockCutoff = new Date(Date.now() - LOCK_TIMEOUT_MS);
  
  const query = `
    SELECT * FROM opportunity_profiles
    WHERE is_active = true
    AND next_run_at <= NOW()
    AND (locked_at IS NULL OR locked_at < $1)
    ORDER BY next_run_at ASC
    LIMIT 10
  `;

  const result = await db.query(query, [lockCutoff]);
  return result.rows;
}

async function acquireLock(profileId) {
  const query = `
    UPDATE opportunity_profiles
    SET locked_at = NOW(), locked_by = $1
    WHERE id = $2
    AND (locked_at IS NULL OR locked_at < $3)
    RETURNING id
  `;

  const lockCutoff = new Date(Date.now() - LOCK_TIMEOUT_MS);
  const result = await db.query(query, [WORKER_ID, profileId, lockCutoff]);
  
  return result.rows.length > 0;
}

async function releaseLock(profileId, success, stats = {}) {
  const nextRun = calculateNextRun({ run_interval_minutes: stats.intervalMinutes });
  
  const query = `
    UPDATE opportunity_profiles
    SET 
      locked_at = NULL,
      locked_by = NULL,
      last_run_at = NOW(),
      next_run_at = $2,
      run_count = run_count + 1,
      last_run_status = $3,
      last_run_stats = $4
    WHERE id = $1
  `;

  await db.query(query, [
    profileId, 
    nextRun, 
    success ? 'success' : 'error',
    JSON.stringify(stats),
  ]);
}

async function getEnabledSubscriptions(profileId) {
  const query = `
    SELECT ss.*, ps.name as source_name, ps.base_url, ps.adapter_type
    FROM source_subscriptions ss
    JOIN procurement_sources ps ON ss.source_id = ps.id
    WHERE ss.profile_id = $1
    AND ss.is_enabled = true
    AND ps.is_active = true
  `;

  const result = await db.query(query, [profileId]);
  return result.rows;
}

async function getSource(sourceId) {
  const result = await db.query(
    'SELECT * FROM procurement_sources WHERE id = $1',
    [sourceId]
  );
  return result.rows[0] || null;
}

async function processProfile(profile) {
  const stats = {
    profileId: profile.id,
    profileName: profile.name,
    startTime: new Date(),
    sourcesProcessed: 0,
    opportunitiesFound: 0,
    newOpportunities: 0,
    updatedOpportunities: 0,
    eventsCreated: 0,
    errors: [],
  };

  logger.info('Processing profile', { profileId: profile.id, name: profile.name });

  try {
    const subscriptions = await getEnabledSubscriptions(profile.id);
    
    if (subscriptions.length === 0) {
      logger.warn('No enabled subscriptions for profile', { profileId: profile.id });
      stats.errors.push('No enabled source subscriptions');
      return stats;
    }

    for (const subscription of subscriptions) {
      try {
        const sourceName = subscription.source_name;
        
        if (!hasAdapter(sourceName)) {
          logger.warn('No adapter for source', { sourceName });
          stats.errors.push('No adapter for source: ' + sourceName);
          continue;
        }

        const adapter = getAdapter(sourceName);
        const source = await getSource(subscription.source_id);

        if (!source) {
          logger.error('Source not found', { sourceId: subscription.source_id });
          continue;
        }

        logger.info('Fetching from source', { sourceName, profileId: profile.id });

        const opportunities = await adapter(profile, source, subscription);
        stats.sourcesProcessed++;
        stats.opportunitiesFound += opportunities.length;

        for (const opp of opportunities) {
          try {
            const { isNew, isUpdated, opportunity } = await upsertOpportunity(opp, profile.id);
            const { score, reasons } = await scoreOpportunity(profile, opportunity);
            await linkOpportunityToProfile(opportunity.id, profile.id, score);

            if (isNew) {
              await createEvent(opportunity.id, profile.id, 'new', { score, reasons, source: sourceName });
              stats.newOpportunities++;
              stats.eventsCreated++;
            } else if (isUpdated) {
              await createEvent(opportunity.id, profile.id, 'updated', { score, reasons, source: sourceName });
              stats.updatedOpportunities++;
              stats.eventsCreated++;
            }

          } catch (oppError) {
            logger.error('Error processing opportunity', { externalId: opp.external_id, error: oppError.message });
            stats.errors.push('Opportunity ' + opp.external_id + ': ' + oppError.message);
          }
        }

      } catch (sourceError) {
        logger.error('Error processing source', { sourceName: subscription.source_name, error: sourceError.message });
        stats.errors.push('Source ' + subscription.source_name + ': ' + sourceError.message);
      }
    }

  } catch (error) {
    logger.error('Error processing profile', { profileId: profile.id, error: error.message });
    stats.errors.push(error.message);
  }

  stats.endTime = new Date();
  stats.durationMs = stats.endTime - stats.startTime;
  stats.intervalMinutes = profile.run_interval_minutes || 60;

  logger.info('Profile processing complete', {
    profileId: profile.id,
    ...stats,
    errorCount: stats.errors.length,
  });

  return stats;
}

async function runProfiles() {
  logger.info('Profile runner starting', { workerId: WORKER_ID });

  try {
    const dueProfiles = await getDueProfiles();
    
    if (dueProfiles.length === 0) {
      logger.debug('No profiles due to run');
      return { processed: 0 };
    }

    logger.info('Found due profiles', { count: dueProfiles.length });

    let processed = 0;
    const results = [];

    for (const profile of dueProfiles) {
      const locked = await acquireLock(profile.id);
      
      if (!locked) {
        logger.debug('Could not acquire lock', { profileId: profile.id });
        continue;
      }

      try {
        const stats = await processProfile(profile);
        results.push(stats);
        await releaseLock(profile.id, stats.errors.length === 0, stats);
        processed++;
      } catch (error) {
        logger.error('Profile processing failed', { profileId: profile.id, error: error.message });
        await releaseLock(profile.id, false, { error: error.message });
      }
    }

    logger.info('Profile runner complete', { processed, total: dueProfiles.length });
    return { processed, results };

  } catch (error) {
    logger.error('Profile runner error', { error: error.message });
    throw error;
  }
}

async function runSingleProfile(profileId) {
  const result = await db.query(
    'SELECT * FROM opportunity_profiles WHERE id = $1',
    [profileId]
  );

  if (result.rows.length === 0) {
    throw new Error('Profile not found: ' + profileId);
  }

  const profile = result.rows[0];
  
  const locked = await acquireLock(profileId);
  if (!locked) {
    throw new Error('Could not acquire lock on profile');
  }

  try {
    const stats = await processProfile(profile);
    await releaseLock(profileId, stats.errors.length === 0, stats);
    return stats;
  } catch (error) {
    await releaseLock(profileId, false, { error: error.message });
    throw error;
  }
}

module.exports = {
  runProfiles,
  runSingleProfile,
  processProfile,
  getDueProfiles,
  WORKER_ID,
};