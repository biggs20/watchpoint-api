/
 * Digest Worker
 * BullMQ worker that processes daily/weekly digest emails
 * Schedules and triggers opportunity digests and weekly briefs
 */

const { Worker, Queue } = require('bullmq');
const { redis } = require('../config/redis');
const { createClient } = require('@supabase/supabase-js');
const { queueDailyDigest, queueWeeklyBrief, DEFAULT_DIGEST_HOUR, DEFAULT_BRIEF_DAY } = require('./notifyWorker');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const QUEUE_NAME = 'digests';

/
 * Get all users who should receive daily digests
 */
const getDigestUsers = async () => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, timezone, digest_enabled, digest_hour')
    .eq('digest_enabled', true);
  
  if (error) {
    console.error('Error fetching digest users:', error.message);
    return [];
  }
  return data || [];
};

/
 * Get all users who should receive weekly briefs
 */
const getWeeklyBriefUsers = async () => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, timezone, weekly_brief_enabled')
    .eq('weekly_brief_enabled', true);
  
  if (error) {
    console.error('Error fetching weekly brief users:', error.message);
    return [];
  }
  return data || [];
};

/
 * Check if it's the right time for a user's digest (based on their timezone)
 */
const isDigestTime = (user, targetHour) => {
  const timezone = user.timezone || 'America/New_York';
  const userHour = user.digest_hour || targetHour;
  
  try {
    const now = new Date();
    const userTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    return userTime.getHours() === userHour;
  } catch {
    // Fallback to server time
    return new Date().getHours() === targetHour;
  }
};

/
 * Check if it's the right day for weekly brief (Sunday by default)
 */
const isWeeklyBriefDay = (user, targetDay) => {
  const timezone = user.timezone || 'America/New_York';
  
  try {
    const now = new Date();
    const userTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    return userTime.getDay() === targetDay;
  } catch {
    return new Date().getDay() === targetDay;
  }
};

/
 * Process digest scheduling job
 */
const processDigestJob = async (job) => {
  const { type } = job.data;
  
  switch (type) {
    case 'schedule_daily_digests':
      return scheduleAllDailyDigests();
    
    case 'schedule_weekly_briefs':
      return scheduleAllWeeklyBriefs();
    
    case 'trigger_daily_digest':
      return triggerDailyDigest(job.data.userId);
    
    case 'trigger_weekly_brief':
      return triggerWeeklyBrief(job.data.userId);
    
    default:
      console.warn('Unknown digest job type:', type);
      return { skipped: true, reason: 'unknown_type' };
  }
};

/
 * Schedule daily digests for all eligible users
 */
const scheduleAllDailyDigests = async () => {
  const users = await getDigestUsers();
  let scheduled = 0;
  
  for (const user of users) {
    if (isDigestTime(user, DEFAULT_DIGEST_HOUR)) {
      await queueDailyDigest(user.id);
      scheduled++;
    }
  }
  
  console.log('Scheduled ' + scheduled + ' daily digests out of ' + users.length + ' eligible users');
  return { scheduled, total: users.length };
};

/
 * Schedule weekly briefs for all eligible users
 */
const scheduleAllWeeklyBriefs = async () => {
  const users = await getWeeklyBriefUsers();
  let scheduled = 0;
  
  for (const user of users) {
    if (isWeeklyBriefDay(user, DEFAULT_BRIEF_DAY) && isDigestTime(user, 18)) {
      await queueWeeklyBrief(user.id);
      scheduled++;
    }
  }
  
  console.log('Scheduled ' + scheduled + ' weekly briefs out of ' + users.length + ' eligible users');
  return { scheduled, total: users.length };
};

/
 * Trigger single user daily digest
 */
const triggerDailyDigest = async (userId) => {
  await queueDailyDigest(userId);
  return { queued: true, userId };
};

/
 * Trigger single user weekly brief
 */
const triggerWeeklyBrief = async (userId) => {
  await queueWeeklyBrief(userId);
  return { queued: true, userId };
};

/
 * Start the digest worker
 */
const startWorker = () => {
  const worker = new Worker(
    QUEUE_NAME,
    processDigestJob,
    {
      connection: redis,
      concurrency: 5,
    }
  );

  worker.on('completed', (job) => {
    console.log('Digest job ' + job.id + ' completed');
  });

  worker.on('failed', (job, err) => {
    console.error('Digest job ' + (job?.id || 'unknown') + ' failed:', err.message);
  });

  console.log('Digest worker started');
  return worker;
};

/
 * Schedule the recurring digest jobs (call from scheduler)
 */
const setupRecurringJobs = async () => {
  const queue = new Queue(QUEUE_NAME, { connection: redis });
  
  // Daily digest scheduler - runs every hour to check user timezones
  await queue.add(
    'schedule_daily_digests',
    { type: 'schedule_daily_digests' },
    {
      repeat: {
        pattern: '0 * * * *' // Every hour at minute 0
      },
      jobId: 'daily-digest-scheduler'
    }
  );
  
  // Weekly brief scheduler - runs every hour on Sunday
  await queue.add(
    'schedule_weekly_briefs',
    { type: 'schedule_weekly_briefs' },
    {
      repeat: {
        pattern: '0 * * * 0' // Every hour on Sunday
      },
      jobId: 'weekly-brief-scheduler'
    }
  );
  
  console.log('Recurring digest jobs scheduled');
};

module.exports = {
  QUEUE_NAME,
  startWorker,
  setupRecurringJobs,
  processDigestJob,
  scheduleAllDailyDigests,
  scheduleAllWeeklyBriefs
};