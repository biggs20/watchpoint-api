/**
 * Monitor Worker
 * BullMQ worker that processes URL monitoring jobs with intelligent change detection
 */

const { Worker } = require('bullmq');
const crypto = require('crypto');
const { redis } = require('../config/redis');
const { computeDiff } = require('../utils/diffEngine');
const { isNoise } = require('../utils/noiseFilter');
const { summarizeChange } = require('../utils/changeSummary');

// Import Supabase client
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Queue name
const QUEUE_NAME = 'monitor';

/**
 * Add cache-busting parameter to URL
 * @param {string} url
 * @returns {string}
 */
const addCacheBuster = (url) => {
  const timestamp = Date.now();
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}watchpoint_cb=${timestamp}`;
};

/**
 * Fetch content from URL with cache-busting headers
 * @param {string} url
 * @returns {Object} - { content, httpStatus, responseTime }
 */
const fetchContent = async (url) => {
  const startTime = Date.now();
  const fetchUrl = addCacheBuster(url);
  
  const response = await fetch(fetchUrl, {
    headers: {
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent': 'WatchPoint/1.0 (+https://watchpoint.app)',
    },
  });
  
  const content = await response.text();
  const responseTime = Date.now() - startTime;
  
  return {
    content: content.trim(),
    httpStatus: response.status,
    responseTime,
  };
};

/**
 * Compute hash for content
 * @param {string} content
 * @returns {string}
 */
const computeHash = (content) => {
  return crypto.createHash('sha256').update(content || '').digest('base64');
};

/**
 * Get the previous snapshot for a watch
 * @param {string} watchId
 * @returns {Object|null}
 */
const getPreviousSnapshot = async (watchId) => {
  const { data, error } = await supabase
    .from('snapshots')
    .select('*')
    .eq('watch_id', watchId)
    .order('captured_at', { ascending: false })
    .limit(1)
    .single();
  
  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
    throw new Error(`Failed to get previous snapshot: ${error.message}`);
  }
  
  return data || null;
};

/**
 * Create a new snapshot
 * @param {string} watchId
 * @param {Object} data
 * @returns {Object}
 */
const createSnapshot = async (watchId, data) => {
  const { data: snapshot, error } = await supabase
    .from('snapshots')
    .insert({
      watch_id: watchId,
      content_text: data.content,
      content_hash: data.contentHash,
      http_status: data.httpStatus,
      response_time_ms: data.responseTime,
      captured_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to create snapshot: ${error.message}`);
  }
  
  return snapshot;
};

/**
 * Create a change record
 * @param {Object} data
 * @returns {Object}
 */
const createChange = async (data) => {
  const { data: change, error } = await supabase
    .from('changes')
    .insert({
      watch_id: data.watchId,
      snapshot_id: data.snapshotId,
      previous_snapshot_id: data.previousSnapshotId,
      change_type: 'content',
      change_summary: data.summary,
      diff_data: JSON.stringify(data.diff),
      notification_sent: false,
      detected_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to create change: ${error.message}`);
  }
  
  return change;
};

/**
 * Update watch next_check_at timestamp
 * @param {string} watchId
 * @param {number} intervalMinutes
 */
const updateWatchSchedule = async (watchId, intervalMinutes = 60) => {
  const nextCheck = new Date(Date.now() + intervalMinutes * 60 * 1000);
  
  await supabase
    .from('watches')
    .update({ next_check_at: nextCheck.toISOString() })
    .eq('id', watchId);
};

/**
 * Process a monitoring job
 * @param {Object} job
 */
const processJob = async (job) => {
  const { watchId, url } = job.data;
  
  console.log(`[Monitor] Processing watch ${watchId} for URL: ${url}`);
  
  // Step 1: Fetch current content with cache-busting
  const { content, httpStatus, responseTime } = await fetchContent(url);
  const contentHash = computeHash(content);
  
  console.log(`[Monitor] Fetched content: ${content.length} chars, status ${httpStatus}, ${responseTime}ms`);
  
  // Step 2: Get previous snapshot
  const previousSnapshot = await getPreviousSnapshot(watchId);
  
  // Step 3: Check if content has changed (hash comparison)
  const hasChanged = !previousSnapshot || previousSnapshot.content_hash !== contentHash;
  
  if (!hasChanged) {
    console.log(`[Monitor] No change detected for watch ${watchId}`);
    await updateWatchSchedule(watchId);
    return { status: 'no_change', watchId };
  }
  
  // Step 4: Content changed - create new snapshot
  const newSnapshot = await createSnapshot(watchId, {
    content,
    contentHash,
    httpStatus,
    responseTime,
  });
  
  console.log(`[Monitor] New snapshot created: ${newSnapshot.id}`);
  
  // Step 5: If no previous snapshot, this is the first check
  if (!previousSnapshot) {
    console.log(`[Monitor] First snapshot for watch ${watchId}`);
    await updateWatchSchedule(watchId);
    return { status: 'first_snapshot', watchId, snapshotId: newSnapshot.id };
  }
  
  // Step 6: Compute diff
  const diff = computeDiff(previousSnapshot.content_text, content);
  
  console.log(`[Monitor] Diff computed: ${diff.totalChanges} total changes (${diff.added.length} added, ${diff.removed.length} removed, ${diff.modified.length} modified)`);
  
  // Step 7: Check if changes are noise
  if (isNoise(diff)) {
    console.log(`[Monitor] Filtered noise - no changes row written for watch ${watchId}`);
    await updateWatchSchedule(watchId);
    return { status: 'noise_filtered', watchId, snapshotId: newSnapshot.id };
  }
  
  // Step 8: Meaningful change - create change record
  const summary = summarizeChange(diff);
  
  const changeRecord = await createChange({
    watchId,
    snapshotId: newSnapshot.id,
    previousSnapshotId: previousSnapshot.id,
    summary,
    diff,
  });
  
  console.log(`[Monitor] Change recorded: ${changeRecord.id} - "${summary}"`);
  
  await updateWatchSchedule(watchId);
  
  return {
    status: 'change_detected',
    watchId,
    snapshotId: newSnapshot.id,
    changeId: changeRecord.id,
    summary,
  };
};

/**
 * Initialize the monitor worker
 */
const startWorker = () => {
  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      try {
        return await processJob(job);
      } catch (error) {
        console.error(`[Monitor] Job ${job.id} failed:`, error.message);
        throw error;
      }
    },
    {
      connection: redis,
      concurrency: 10,
      limiter: {
        max: 100,
        duration: 60000,
      },
    }
  );

  worker.on('completed', (job, result) => {
    console.log(`[Monitor] Job ${job.id} completed: ${result?.status || 'unknown'}`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Monitor] Job ${job?.id} failed:`, err.message);
  });

  console.log('🔄 Monitor worker started with change intelligence');
  return worker;
};

// Export for testing
module.exports = {
  QUEUE_NAME,
  startWorker,
  processJob,
  fetchContent,
  computeHash,
  addCacheBuster,
};
