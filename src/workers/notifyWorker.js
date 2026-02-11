/
 * Notify Worker
 * BullMQ worker that processes notification jobs for detected changes
 * Enhanced with opportunity digest and urgent alert processing
 */

const { Worker, Queue } = require('bullmq');
const { redis } = require('../config/redis');
const { 
  sendChangeEmail, 
  sendDailyDigest, 
  sendUrgentAlert, 
  sendWeeklyBrief 
} = require('../services/notificationService');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const QUEUE_NAME = 'notify';
const DEFAULT_DIGEST_HOUR = parseInt(process.env.DEFAULT_DIGEST_HOUR || '7', 10);
const DEFAULT_BRIEF_DAY = parseInt(process.env.DEFAULT_BRIEF_DAY || '0', 10); // 0 = Sunday

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

const hasNotificationSent = async (changeId) => {
  const { data, error } = await supabase
    .from('notifications')
    .select('id')
    .eq('change_id', changeId)
    .eq('channel', 'email')
    .single();
  
  return !error && data !== null;
};

const recordNotification = async (changeId, userId, channel, status, errorMsg = null) => {
  const { error } = await supabase
    .from('notifications')
    .insert({
      change_id: changeId,
      user_id: userId,
      channel: channel,
      status: status,
      error: errorMsg,
      sent_at: status === 'sent' ? new Date().toISOString() : null
    });
  
  if (error) {
    console.error('Error recording notification:', error.message);
  }
};

/
 * Load matched opportunities for a user (for daily digest)
 */
const loadUserOpportunities = async (userId, since) => {
  const { data, error } = await supabase
    .from('opportunities')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', since.toISOString())
    .order('fit_score', { ascending: false });
  
  if (error) {
    console.error('Error loading opportunities:', error.message);
    return [];
  }
  return data || [];
};

/
 * Load high-priority opportunity
 */
const loadOpportunity = async (opportunityId) => {
  const { data, error } = await supabase
    .from('opportunities')
    .select('*')
    .eq('id', opportunityId)
    .single();
  
  if (error) {
    console.error('Error loading opportunity:', error.message);
    return null;
  }
  return data;
};

/
 * Get weekly stats for a user
 */
const getWeeklyStats = async (userId) => {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  
  const { data: opportunities } = await supabase
    .from('opportunities')
    .select('id, status')
    .eq('user_id', userId)
    .gte('created_at', weekAgo.toISOString());
  
  return {
    newOpportunities: opportunities?.length || 0,
    pursued: opportunities?.filter(o => o.status === 'pursuing').length || 0,
    won: opportunities?.filter(o => o.status === 'won').length || 0
  };
};

/
 * Get upcoming deadlines for a user
 */
const getUpcomingDeadlines = async (userId) => {
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  
  const { data, error } = await supabase
    .from('opportunities')
    .select('*')
    .eq('user_id', userId)
    .lte('due_at', nextWeek.toISOString())
    .gte('due_at', new Date().toISOString())
    .order('due_at', { ascending: true });
  
  return data || [];
};

/
 * Get recently missed opportunities
 */
const getMissedOpportunities = async (userId) => {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  
  const { data, error } = await supabase
    .from('opportunities')
    .select('*')
    .eq('user_id', userId)
    .is('status', null)
    .lte('due_at', new Date().toISOString())
    .gte('due_at', weekAgo.toISOString())
    .order('fit_score', { ascending: false })
    .limit(5);
  
  return data || [];
};

/
 * Get active agencies for user's NAICS codes
 */
const getActiveAgencies = async (userId) => {
  // Get user's NAICS preferences
  const { data: profile } = await supabase
    .from('profiles')
    .select('naics_codes')
    .eq('id', userId)
    .single();
  
  if (!profile?.naics_codes?.length) return [];
  
  // Aggregate by agency
  const { data: agencies } = await supabase
    .from('opportunities')
    .select('buyer')
    .in('naics_code', profile.naics_codes)
    .gte('posted_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
  
  if (!agencies) return [];
  
  const agencyCounts = {};
  agencies.forEach(o => {
    if (o.buyer) {
      agencyCounts[o.buyer] = (agencyCounts[o.buyer] || 0) + 1;
    }
  });
  
  return Object.entries(agencyCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
};

/
 * Process different job types
 */
const processJob = async (job) => {
  const { type, data } = job.data;
  
  switch (type) {
    case 'change_notification':
      return processChangeNotification(data);
    
    case 'daily_digest':
      return processDailyDigest(data);
    
    case 'urgent_alert':
      return processUrgentAlert(data);
    
    case 'weekly_brief':
      return processWeeklyBrief(data);
    
    default:
      // Legacy support: treat as change notification
      return processChangeNotification(job.data);
  }
};

/
 * Process change notification (existing functionality)
 */
const processChangeNotification = async (data) => {
  const { changeId } = data;
  
  const change = await loadChange(changeId);
  if (!change) {
    throw new Error('Change not found: ' + changeId);
  }

  const watch = await loadWatch(change.watch_id);
  if (!watch) {
    throw new Error('Watch not found for change: ' + changeId);
  }

  const profile = await loadProfile(watch.user_id);
  if (!profile) {
    throw new Error('Profile not found for watch: ' + watch.id);
  }

  const alreadySent = await hasNotificationSent(changeId);
  if (alreadySent) {
    console.log('Notification already sent for change ' + changeId + ', skipping');
    return { skipped: true, reason: 'already_sent' };
  }

  const result = await sendChangeEmail(change, watch, profile);
  
  await recordNotification(
    changeId,
    watch.user_id,
    'email',
    result.success ? 'sent' : 'failed',
    result.error
  );

  return result;
};

/
 * Process daily digest
 */
const processDailyDigest = async (data) => {
  const { userId } = data;
  
  const profile = await loadProfile(userId);
  if (!profile) {
    throw new Error('Profile not found: ' + userId);
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  const opportunities = await loadUserOpportunities(userId, yesterday);
  
  const result = await sendDailyDigest(profile, opportunities);
  
  console.log('Daily digest processed for user ' + userId + ': ' + JSON.stringify(result));
  return result;
};

/
 * Process urgent alert (90+ fit or <3 days to deadline)
 */
const processUrgentAlert = async (data) => {
  const { userId, opportunityId } = data;
  
  const profile = await loadProfile(userId);
  if (!profile) {
    throw new Error('Profile not found: ' + userId);
  }

  const opportunity = await loadOpportunity(opportunityId);
  if (!opportunity) {
    throw new Error('Opportunity not found: ' + opportunityId);
  }

  const result = await sendUrgentAlert(profile, opportunity);
  
  console.log('Urgent alert sent for opportunity ' + opportunityId + ' to user ' + userId);
  return result;
};

/
 * Process weekly brief
 */
const processWeeklyBrief = async (data) => {
  const { userId } = data;
  
  const profile = await loadProfile(userId);
  if (!profile) {
    throw new Error('Profile not found: ' + userId);
  }

  const [stats, upcomingDeadlines, missedOpportunities, activeAgencies] = await Promise.all([
    getWeeklyStats(userId),
    getUpcomingDeadlines(userId),
    getMissedOpportunities(userId),
    getActiveAgencies(userId)
  ]);

  const result = await sendWeeklyBrief(profile, {
    stats,
    upcomingDeadlines,
    missedOpportunities,
    activeAgencies
  });
  
  console.log('Weekly brief sent to user ' + userId);
  return result;
};

/
 * Start the notify worker
 */
const startWorker = () => {
  const worker = new Worker(
    QUEUE_NAME,
    processJob,
    {
      connection: redis,
      concurrency: 10,
    }
  );

  worker.on('completed', (job) => {
    console.log('Notify job ' + job.id + ' completed');
  });

  worker.on('failed', (job, err) => {
    console.error('Notify job ' + (job?.id || 'unknown') + ' failed:', err.message);
  });

  console.log('Notify worker started (change notifications + opportunity emails)');
  return worker;
};

/
 * Queue helper: Add daily digest job
 */
const queueDailyDigest = async (userId) => {
  const queue = new Queue(QUEUE_NAME, { connection: redis });
  await queue.add('daily_digest', {
    type: 'daily_digest',
    data: { userId }
  }, {
    jobId: 'digest-' + userId + '-' + new Date().toISOString().split('T')[0]
  });
};

/
 * Queue helper: Add urgent alert job
 */
const queueUrgentAlert = async (userId, opportunityId) => {
  const queue = new Queue(QUEUE_NAME, { connection: redis });
  await queue.add('urgent_alert', {
    type: 'urgent_alert',
    data: { userId, opportunityId }
  }, {
    priority: 1, // High priority
    jobId: 'urgent-' + opportunityId + '-' + userId
  });
};

/
 * Queue helper: Add weekly brief job
 */
const queueWeeklyBrief = async (userId) => {
  const queue = new Queue(QUEUE_NAME, { connection: redis });
  await queue.add('weekly_brief', {
    type: 'weekly_brief',
    data: { userId }
  }, {
    jobId: 'brief-' + userId + '-' + new Date().toISOString().split('T')[0]
  });
};

module.exports = {
  QUEUE_NAME,
  startWorker,
  processJob,
  queueDailyDigest,
  queueUrgentAlert,
  queueWeeklyBrief,
  DEFAULT_DIGEST_HOUR,
  DEFAULT_BRIEF_DAY
};