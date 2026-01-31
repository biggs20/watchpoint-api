/**
 * Scheduler
 * Uses node-cron to schedule recurring jobs
 */

const cron = require('node-cron');
const { Queue } = require('bullmq');
const { redis } = require('../config/redis');

// TODO: Import services
// const { query } = require('../config/database');

// Initialize queues
const monitorQueue = new Queue('monitor', { connection: redis });
const digestQueue = new Queue('digests', { connection: redis });

/**
 * TODO: Schedule all watches based on their frequency
 * Called on server startup
 */
const scheduleWatches = async () => {
  // TODO: Get all active watches from database
  // TODO: Group by frequency
  // TODO: Schedule jobs accordingly
  console.log('📋 Watch scheduler not implemented');
};

/**
 * TODO: Schedule a single watch
 * @param {Object} watch
 */
const scheduleWatch = async (watch) => {
  // TODO: Add repeatable job to monitor queue based on watch frequency
  throw new Error('Not implemented');
};

/**
 * TODO: Cancel scheduled jobs for a watch
 * @param {string} watchId
 */
const cancelWatch = async (watchId) => {
  // TODO: Remove repeatable job from monitor queue
  throw new Error('Not implemented');
};

/**
 * TODO: Initialize all cron jobs
 */
const initCronJobs = () => {
  // Schedule daily digests at 8 AM UTC
  cron.schedule('0 8 * * *', async () => {
    console.log('🌅 Running daily digest job');
    // TODO: Get all users with daily digest enabled
    // TODO: Add digest jobs to queue
  });

  // Schedule weekly digests on Monday at 8 AM UTC
  cron.schedule('0 8 * * 1', async () => {
    console.log('📅 Running weekly digest job');
    // TODO: Get all users with weekly digest enabled
    // TODO: Add digest jobs to queue
  });

  // Cleanup old snapshots daily at 3 AM UTC
  cron.schedule('0 3 * * *', async () => {
    console.log('🧹 Running snapshot cleanup');
    // TODO: Delete snapshots older than retention period
  });

  console.log('⏰ Cron jobs initialized');
};

module.exports = {
  scheduleWatches,
  scheduleWatch,
  cancelWatch,
  initCronJobs,
  monitorQueue,
  digestQueue,
};
