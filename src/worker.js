/
 * Main Worker Entry Point
 * Manages BullMQ workers for profile processing and notifications
 */

require('dotenv').config();

const { Worker, Queue } = require('bullmq');
const Redis = require('ioredis');
const logger = require('./utils/logger');
const { runProfiles, runSingleProfile } = require('./workers/profileRunner');

// Redis connection
const redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// Queues
const profileQueue = new Queue('profile-runner', { connection: redisConnection });
const notifyQueue = new Queue('notifications', { connection: redisConnection });

// Profile Runner Worker - processes opportunity profiles
const profileWorker = new Worker(
  'profile-runner',
  async (job) => {
    logger.info('Profile runner job started', { jobId: job.id, data: job.data });

    try {
      if (job.data.profileId) {
        // Run single profile (on-demand)
        const result = await runSingleProfile(job.data.profileId);
        return result;
      } else {
        // Run all due profiles (scheduled)
        const result = await runProfiles();
        return result;
      }
    } catch (error) {
      logger.error('Profile runner job failed', { jobId: job.id, error: error.message });
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 1, // Process one at a time to avoid overwhelming sources
  }
);

// Notification Worker - sends alerts for new opportunities
const notifyWorker = new Worker(
  'notifications',
  async (job) => {
    logger.info('Notification job started', { jobId: job.id, type: job.data.type });

    try {
      const { type, payload } = job.data;

      switch (type) {
        case 'new_opportunity':
          await sendNewOpportunityNotification(payload);
          break;
        case 'digest':
          await sendDigestNotification(payload);
          break;
        case 'deadline_reminder':
          await sendDeadlineReminder(payload);
          break;
        default:
          logger.warn('Unknown notification type', { type });
      }

      return { success: true };
    } catch (error) {
      logger.error('Notification job failed', { jobId: job.id, error: error.message });
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 5,
  }
);

// Notification handlers
async function sendNewOpportunityNotification(payload) {
  const { userId, opportunity, profile, fitScore } = payload;
  
  // Get user notification preferences
  const db = require('./config/database');
  const userResult = await db.query(
    'SELECT email, notification_preferences FROM profiles WHERE user_id = $1',
    [userId]
  );

  if (userResult.rows.length === 0) return;

  const user = userResult.rows[0];
  const prefs = user.notification_preferences || {};

  // Check if user wants immediate notifications
  if (prefs.immediate_alerts !== false && fitScore >= (prefs.min_score || 50)) {
    const sendgrid = require('./config/sendgrid');
    await sendgrid.send({
      to: user.email,
      from: process.env.SENDGRID_FROM_EMAIL,
      subject: 'New Opportunity Match: ' + opportunity.title.slice(0, 50),
      html: buildOpportunityEmail(opportunity, profile, fitScore),
    });
  }
}

async function sendDigestNotification(payload) {
  const { userId, profileId, opportunities } = payload;
  
  const db = require('./config/database');
  const userResult = await db.query(
    'SELECT email FROM profiles WHERE user_id = $1',
    [userId]
  );

  if (userResult.rows.length === 0 || opportunities.length === 0) return;

  const sendgrid = require('./config/sendgrid');
  await sendgrid.send({
    to: userResult.rows[0].email,
    from: process.env.SENDGRID_FROM_EMAIL,
    subject: 'GovBid Scout: ' + opportunities.length + ' New Opportunities',
    html: buildDigestEmail(opportunities),
  });
}

async function sendDeadlineReminder(payload) {
  const { userId, opportunity, daysUntilDeadline } = payload;
  
  const db = require('./config/database');
  const userResult = await db.query(
    'SELECT email FROM profiles WHERE user_id = $1',
    [userId]
  );

  if (userResult.rows.length === 0) return;

  const sendgrid = require('./config/sendgrid');
  await sendgrid.send({
    to: userResult.rows[0].email,
    from: process.env.SENDGRID_FROM_EMAIL,
    subject: 'Deadline Reminder: ' + daysUntilDeadline + ' days left - ' + opportunity.title.slice(0, 40),
    html: buildDeadlineEmail(opportunity, daysUntilDeadline),
  });
}

// Email templates
function buildOpportunityEmail(opportunity, profile, fitScore) {
  return '<html><body style="font-family: Arial, sans-serif;">' +
    '<h2>New Opportunity Match</h2>' +
    '<p>A new opportunity matching your <strong>' + profile.name + '</strong> profile has been found:</p>' +
    '<div style="border: 1px solid #ddd; padding: 15px; margin: 15px 0; border-radius: 5px;">' +
    '<h3 style="margin-top: 0;">' + opportunity.title + '</h3>' +
    '<p><strong>Buyer:</strong> ' + opportunity.buyer + '</p>' +
    '<p><strong>Fit Score:</strong> ' + fitScore + '/100</p>' +
    (opportunity.response_due_at ? '<p><strong>Due Date:</strong> ' + new Date(opportunity.response_due_at).toLocaleDateString() + '</p>' : '') +
    (opportunity.set_aside ? '<p><strong>Set-Aside:</strong> ' + opportunity.set_aside + '</p>' : '') +
    '<a href="' + opportunity.url + '" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">View Opportunity</a>' +
    '</div>' +
    '<p style="color: #666; font-size: 12px;">You received this email because you have alerts enabled for the ' + profile.name + ' profile.</p>' +
    '</body></html>';
}

function buildDigestEmail(opportunities) {
  const oppList = opportunities.map(opp => 
    '<li style="margin-bottom: 15px;">' +
    '<strong>' + opp.title + '</strong><br>' +
    '<span style="color: #666;">' + opp.buyer + '</span><br>' +
    '<a href="' + opp.url + '">View Details</a>' +
    '</li>'
  ).join('');

  return '<html><body style="font-family: Arial, sans-serif;">' +
    '<h2>Your GovBid Scout Digest</h2>' +
    '<p>' + opportunities.length + ' new opportunities match your profiles:</p>' +
    '<ul>' + oppList + '</ul>' +
    '<p style="color: #666; font-size: 12px;">Manage your notification preferences in your GovBid Scout dashboard.</p>' +
    '</body></html>';
}

function buildDeadlineEmail(opportunity, daysUntilDeadline) {
  return '<html><body style="font-family: Arial, sans-serif;">' +
    '<h2>Deadline Reminder</h2>' +
    '<p style="color: ' + (daysUntilDeadline <= 3 ? '#dc3545' : '#ffc107') + '; font-weight: bold;">' +
    daysUntilDeadline + ' days remaining to respond!</p>' +
    '<div style="border: 1px solid #ddd; padding: 15px; margin: 15px 0; border-radius: 5px;">' +
    '<h3 style="margin-top: 0;">' + opportunity.title + '</h3>' +
    '<p><strong>Buyer:</strong> ' + opportunity.buyer + '</p>' +
    '<p><strong>Deadline:</strong> ' + new Date(opportunity.response_due_at).toLocaleDateString() + '</p>' +
    '<a href="' + opportunity.url + '" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">View Opportunity</a>' +
    '</div>' +
    '</body></html>';
}

// Schedule profile runner to check every 5 minutes
async function scheduleProfileRunner() {
  // Remove existing repeatable jobs
  const repeatableJobs = await profileQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await profileQueue.removeRepeatableByKey(job.key);
  }

  // Add new repeatable job - every 5 minutes
  await profileQueue.add(
    'scheduled-run',
    { scheduled: true },
    {
      repeat: {
        pattern: '*/5 * * * *', // Every 5 minutes
      },
      removeOnComplete: 100,
      removeOnFail: 50,
    }
  );

  logger.info('Profile runner scheduled to run every 5 minutes');
}

// Worker event handlers
profileWorker.on('completed', (job, result) => {
  logger.info('Profile runner job completed', { jobId: job.id, processed: result?.processed });
});

profileWorker.on('failed', (job, error) => {
  logger.error('Profile runner job failed', { jobId: job?.id, error: error.message });
});

notifyWorker.on('completed', (job) => {
  logger.info('Notification job completed', { jobId: job.id });
});

notifyWorker.on('failed', (job, error) => {
  logger.error('Notification job failed', { jobId: job?.id, error: error.message });
});

// Graceful shutdown
async function shutdown() {
  logger.info('Shutting down workers...');
  await profileWorker.close();
  await notifyWorker.close();
  await redisConnection.quit();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Initialize
async function start() {
  logger.info('Starting GovBid Scout workers...');
  await scheduleProfileRunner();
  logger.info('Workers started successfully');
}

start().catch(err => {
  logger.error('Failed to start workers', { error: err.message });
  process.exit(1);
});

module.exports = {
  profileQueue,
  notifyQueue,
  profileWorker,
  notifyWorker,
};