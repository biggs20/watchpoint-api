/**
 * Notify Backfill
 * Periodically checks for changes that haven't been notified
 * and enqueues them for notification
 */

const { Queue } = require('bullmq');
const { redis } = require('../config/redis');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Queue name (same as notifyWorker)
const NOTIFY_QUEUE_NAME = 'notify';

// Initialize queue
const notifyQueue = new Queue(NOTIFY_QUEUE_NAME, { connection: redis });

/**
 * Get changes that need notification
 * - notification_sent = false
 * - detected_at within last 24 hours
 * - limit 50 per run
 */
const getUnnotifiedChanges = async () => {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  const { data, error } = await supabase
    .from('changes')
    .select('id, watch_id')
    .eq('notification_sent', false)
    .gte('detected_at', twentyFourHoursAgo)
    .order('detected_at', { ascending: true })
    .limit(50);
  
  if (error) {
    console.error('Error fetching unnotified changes:', error.message);
    return [];
  }
  
  return data || [];
};

/**
 * Check if change already has a 'sent' notification
 */
const hasSuccessfulNotification = async (changeId) => {
  const { data, error } = await supabase
    .from('notifications')
    .select('id')
    .eq('change_id', changeId)
    .eq('delivery_status', 'sent')
    .limit(1);
  
  if (error) {
    console.error('Error checking notification:', error.message);
    return false;
  }
  
  return data && data.length > 0;
};

/**
 * Run the backfill process
 */
const runBackfill = async () => {
  console.log('Running notification backfill...');
  
  const changes = await getUnnotifiedChanges();
  
  if (changes.length === 0) {
    console.log('No unnotified changes found');
    return { enqueued: 0 };
  }
  
  let enqueued = 0;
  
  for (const change of changes) {
    // Skip if already has successful notification
    const hasSent = await hasSuccessfulNotification(change.id);
    if (hasSent) {
      console.log(`Change ${change.id} already has successful notification, skipping`);
      continue;
    }
    
    // Enqueue the job
    await notifyQueue.add('notify-backfill', { change_id: change.id }, {
      jobId: `backfill-${change.id}`,
      removeOnComplete: true,
      removeOnFail: 100,
    });
    
    enqueued++;
  }
  
  console.log(`Backfill: enqueued ${enqueued} notification jobs`);
  return { enqueued };
};

/**
 * Start the backfill scheduler (runs every 2 minutes)
 */
const startBackfillScheduler = () => {
  // Run immediately on start
  runBackfill().catch(err => console.error('Backfill error:', err.message));
  
  // Then run every 2 minutes
  const interval = setInterval(() => {
    runBackfill().catch(err => console.error('Backfill error:', err.message));
  }, 2 * 60 * 1000);
  
  console.log('Notify backfill scheduler started (every 2 minutes)');
  
  return interval;
};

module.exports = {
  runBackfill,
  startBackfillScheduler,
  getUnnotifiedChanges,
};
