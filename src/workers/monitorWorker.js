/**
 * Monitor Worker
 * BullMQ worker that processes URL monitoring jobs
 */

const { Worker } = require('bullmq');
const { redis } = require('../config/redis');

// TODO: Import services
// const { changeDetectionService } = require('../services/changeDetectionService');
// const { snapshotService } = require('../services/snapshotService');
// const { notificationService } = require('../services/notificationService');
// const { query } = require('../config/database');

// Queue name
const QUEUE_NAME = 'monitor';

/**
 * TODO: Initialize the monitor worker
 */
const startWorker = () => {
  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      // TODO: Extract watch data from job
      // const { watchId, userId, url, selector } = job.data;
      
      // TODO: Implement job processing:
      // 1. Fetch current content
      // 2. Compare with last snapshot
      // 3. If changed, create new snapshot
      // 4. If changed, send notifications
      // 5. Update watch's last_checked timestamp
      
      console.log(`Processing job ${job.id} for watch ${job.data?.watchId}`);
      throw new Error('Worker not implemented');
    },
    {
      connection: redis,
      concurrency: 10, // Process 10 jobs concurrently
      limiter: {
        max: 100,
        duration: 60000, // 100 jobs per minute max
      },
    }
  );

  worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed:`, err.message);
  });

  console.log('🔄 Monitor worker started');
  return worker;
};

module.exports = {
  QUEUE_NAME,
  startWorker,
};
