/**
 * Notify Worker
 * BullMQ worker that processes notification jobs for detected changes
 * Handles SendGrid gracefully - records failure but doesn't block
 */

const { Worker, Queue } = require('bullmq');
const { redis } = require('../config/redis');
const { sendChangeEmail } = require('../services/notificationService');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Queue name
const QUEUE_NAME = 'notify';

/**
 * Load change by ID
 * @param {string} changeId
 * @returns {Object|null}
 */
const loadChange = async (changeId) => {
  const { data, error } = await supabase
    .from('changes')
    .select('*')
    .eq('id', changeId)
    .single();
  
  if (error) {
    console.error('Error loading change:', error.message);
    return null;
  }
  return data;
};

/**
 * Load watch by ID
 * @param {string} watchId
 * @returns {Object|null}
 */
const loadWatch = async (watchId) => {
  const { data, error } = await supabase
    .from('watches')
    .select('*')
    .eq('id', watchId)
    .single();
  
  if (error) {
    console.error('Error loading watch:', error.message);
    return null;
  }
  return data;
};

/**
 * Load user profile by ID
 * @param {string} userId
 * @returns {Object|null}
 */
const loadProfile = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (error) {
    console.error('Error loading profile:', error.message);
    return null;
  }
  return data;
};

/**
 * Check if notification already sent for this change
 * @param {string} changeId
 * @returns {boolean}
 */
const hasNotificationSent = async (changeId) => {
  const { data, error } = await supabase
    .from('notifications')
    .select('id')
    .eq('change_id', changeId)
    .eq('channel', 'email')
    .eq('delivery_status', 'sent')
    .limit(1);
  
  if (error) {
    console.error('Error checking notifications:', error.message);
    return false;
  }
  
  return data && data.length > 0;
};

/**
 * Insert notification record
 * @param {Object} notification
 * @returns {Object|null}
 */
const insertNotification = async (notification) => {
  const { data, error } = await supabase
    .from('notifications')
    .insert(notification)
    .select()
    .single();
  
  if (error) {
    console.error('Error inserting notification:', error.message);
    return null;
  }
  return data;
};

/**
 * Update change notification status
 * @param {string} changeId
 */
const markChangeSent = async (changeId) => {
  const { error } = await supabase
    .from('changes')
    .update({
      notification_sent: true,
      notification_sent_at: new Date().toISOString()
    })
    .eq('id', changeId);
  
  if (error) {
    console.error('Error updating change:', error.message);
  }
};

/**
 * Process a notification job
 * @param {Object} job
 */
const processJob = async (job) => {
  const { change_id } = job.data;
  
  console.log(`Processing notification job for change_id: ${change_id}`);
  
  // 1. Load the change
  const change = await loadChange(change_id);
  if (!change) {
    console.error(`Change not found: ${change_id}`);
    return { success: false, reason: 'change_not_found' };
  }
  
  // 2. IDEMPOTENCY CHECK 1: Skip if already marked as sent
  if (change.notification_sent === true) {
    console.log(`Change ${change_id} already has notification_sent=true, skipping`);
    return { success: true, reason: 'already_sent' };
  }
  
  // 3. Load the watch
  const watch = await loadWatch(change.watch_id);
  if (!watch) {
    console.error(`Watch not found: ${change.watch_id}`);
    return { success: false, reason: 'watch_not_found' };
  }
  
  // 4. Load the user profile
  const user = await loadProfile(watch.user_id);
  if (!user) {
    console.error(`User not found: ${watch.user_id}`);
    return { success: false, reason: 'user_not_found' };
  }
  
  if (!user.email) {
    console.error(`User ${watch.user_id} has no email`);
    return { success: false, reason: 'no_email' };
  }
  
  // 5. IDEMPOTENCY CHECK 2: Check if notification already sent
  const alreadySent = await hasNotificationSent(change_id);
  if (alreadySent) {
    console.log(`Notification already sent for change ${change_id}, skipping`);
    return { success: true, reason: 'notification_exists' };
  }
  
  // 6. Build email subject for record
  const hostname = new URL(watch.target_url).hostname;
  const watchName = watch.name || hostname;
  const changeSummary = change.change_summary || 'Content has changed';
  const subject = `WatchPoint Alert: ${watchName} — ${changeSummary}`;
  
  // 7. Try to send email
  try {
    await sendChangeEmail({ user, watch, change });
    
    // 8a. SUCCESS: Insert notification with 'sent' status
    await insertNotification({
      user_id: user.id,
      watch_id: watch.id,
      change_id: change.id,
      notification_type: 'change_detected',
      title: subject,
      body: changeSummary,
      channel: 'email',
      delivery_status: 'sent',
      delivered_at: new Date().toISOString(),
      is_read: false
    });
    
    // Mark change as notification sent
    await markChangeSent(change.id);
    
    console.log(`Notification sent successfully for change ${change_id}`);
    return { success: true };
    
  } catch (error) {
    // 8b. ERROR: Handle gracefully
    const errorMessage = error.message || 'unknown_error';
    
    if (errorMessage === 'sendgrid_not_configured') {
      console.log('SendGrid not configured – email skipped');
    } else {
      console.error(`Email send failed: ${errorMessage}`);
    }
    
    // Insert notification with 'failed' status
    await insertNotification({
      user_id: user.id,
      watch_id: watch.id,
      change_id: change.id,
      notification_type: 'change_detected',
      title: subject,
      body: changeSummary,
      channel: 'email',
      delivery_status: 'failed',
      delivery_error: errorMessage,
      is_read: false
    });
    
    // Do NOT mark change.notification_sent=true (leave false for retry)
    console.log(`Notification recorded as failed for change ${change_id}, will retry later`);
    
    // Job completes successfully (we recorded the failure)
    return { success: true, reason: 'recorded_failure' };
  }
};

/**
 * Initialize the notification worker
 */
const startWorker = () => {
  const worker = new Worker(
    QUEUE_NAME,
    processJob,
    {
      connection: redis,
      concurrency: 5,
    }
  );

  worker.on('completed', (job, result) => {
    console.log(`Notification job ${job.id} completed:`, result);
  });

  worker.on('failed', (job, err) => {
    console.error(`Notification job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('Notify worker error:', err.message);
  });

  console.log(`Notify worker started (queue: ${QUEUE_NAME}, concurrency: 5)`);
  return worker;
};

// Export the queue for adding jobs
const notifyQueue = new Queue(QUEUE_NAME, { connection: redis });

module.exports = {
  startWorker,
  notifyQueue,
  QUEUE_NAME,
  processJob,
};
