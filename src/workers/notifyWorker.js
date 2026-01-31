/**
 * Notify Worker
 * BullMQ worker that processes notification jobs
 */

const { Worker } = require('bullmq');
const { redis } = require('../config/redis');

// TODO: Import services
// const { notificationService } = require('../services/notificationService');

// Queue name
const QUEUE_NAME = 'notifications';

/**
 * TODO: Initialize the notification worker
 */
const startWorker = () => {
  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      // TODO: Extract notification data from job
      // const { type, userId, watchId, change } = job.data;
      
      // TODO: Implement job processing:
      // 1. Get user's notification preferences
      // 2. Send email if enabled
      // 3. Send SMS if enabled
      // 4. Log notification sent
      
      console.log(`Processing notification job ${job.id}`);
      throw new Error('Worker not implemented');
    },
    {
      connection: redis,
      concurrency: 20, // Notifications can be processed faster
    }
  );

  worker.on('completed', (job) => {
    console.log(`Notification job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Notification job ${job?.id} failed:`, err.message);
  });

  console.log('📬 Notification worker started');
  return worker;
};

module.exports = {
  QUEUE_NAME,
  startWorker,
};
