/
 * Opportunity Service
 * Handles CRUD operations for opportunities and events
 */

const db = require('../config/database');
const logger = require('../utils/logger');
const { scoreFit } = require('./fitScorer');

async function upsertOpportunity(opp, profileId) {
  const query = `
    INSERT INTO opportunities (
      source_id, external_id, title, description, buyer, naics,
      set_aside, value_min, value_max, posted_at, response_due_at,
      url, level, state, raw_data, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW()
    )
    ON CONFLICT (source_id, external_id) 
    DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      buyer = EXCLUDED.buyer,
      naics = EXCLUDED.naics,
      set_aside = EXCLUDED.set_aside,
      value_min = EXCLUDED.value_min,
      value_max = EXCLUDED.value_max,
      response_due_at = EXCLUDED.response_due_at,
      url = EXCLUDED.url,
      raw_data = EXCLUDED.raw_data,
      updated_at = NOW()
    RETURNING *, (xmax = 0) AS is_new, (xmax != 0) AS is_updated
  `;

  const values = [
    opp.source_id, opp.external_id, opp.title, opp.description, opp.buyer, opp.naics,
    opp.set_aside, opp.value_min, opp.value_max, opp.posted_at, opp.response_due_at,
    opp.url, opp.level, opp.state, JSON.stringify(opp.raw_data || {}),
  ];

  try {
    const result = await db.query(query, values);
    const row = result.rows[0];
    
    return {
      isNew: row.is_new,
      isUpdated: row.is_updated,
      opportunity: {
        id: row.id, source_id: row.source_id, external_id: row.external_id,
        title: row.title, description: row.description, buyer: row.buyer,
        naics: row.naics, set_aside: row.set_aside, value_min: row.value_min,
        value_max: row.value_max, posted_at: row.posted_at, response_due_at: row.response_due_at,
        url: row.url, level: row.level, state: row.state,
      },
    };
  } catch (error) {
    logger.error('Failed to upsert opportunity', { external_id: opp.external_id, error: error.message });
    throw error;
  }
}

async function createEvent(opportunityId, profileId, eventType, diffData = null) {
  const query = `
    INSERT INTO opportunity_events (opportunity_id, profile_id, event_type, diff_data, created_at)
    VALUES ($1, $2, $3, $4, NOW())
    RETURNING *
  `;

  try {
    const result = await db.query(query, [
      opportunityId, profileId, eventType, diffData ? JSON.stringify(diffData) : null,
    ]);
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to create opportunity event', { opportunityId, eventType, error: error.message });
    throw error;
  }
}

async function scoreOpportunity(profile, opportunity) {
  return scoreFit(profile, opportunity);
}

async function linkOpportunityToProfile(opportunityId, profileId, fitScore) {
  const query = `
    INSERT INTO profile_opportunities (profile_id, opportunity_id, fit_score, created_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (profile_id, opportunity_id)
    DO UPDATE SET fit_score = $3, updated_at = NOW()
  `;

  try {
    await db.query(query, [profileId, opportunityId, fitScore]);
  } catch (error) {
    logger.warn('Could not link opportunity to profile', { opportunityId, profileId, error: error.message });
  }
}

async function getOpportunitiesForProfile(profileId, options = {}) {
  const { limit = 50, offset = 0, minScore = 0 } = options;
  
  const query = `
    SELECT o.*, po.fit_score
    FROM opportunities o
    LEFT JOIN profile_opportunities po ON o.id = po.opportunity_id AND po.profile_id = $1
    WHERE po.profile_id = $1 AND (po.fit_score >= $2 OR po.fit_score IS NULL)
    ORDER BY po.fit_score DESC NULLS LAST, o.posted_at DESC
    LIMIT $3 OFFSET $4
  `;

  try {
    const result = await db.query(query, [profileId, minScore, limit, offset]);
    return result.rows;
  } catch (error) {
    logger.error('Failed to get opportunities for profile', { profileId, error: error.message });
    return [];
  }
}

async function getRecentEvents(profileId, limit = 20) {
  const query = `
    SELECT e.*, o.title, o.url, o.buyer
    FROM opportunity_events e
    JOIN opportunities o ON e.opportunity_id = o.id
    WHERE e.profile_id = $1
    ORDER BY e.created_at DESC
    LIMIT $2
  `;

  try {
    const result = await db.query(query, [profileId, limit]);
    return result.rows;
  } catch (error) {
    logger.error('Failed to get recent events', { profileId, error: error.message });
    return [];
  }
}

module.exports = {
  upsertOpportunity, createEvent, scoreOpportunity,
  linkOpportunityToProfile, getOpportunitiesForProfile, getRecentEvents,
};