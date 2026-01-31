/**
 * Digest Worker
 * BullMQ worker that processes daily/weekly digest emails
 */

const { Worker } = require('bullmq');
const { redis } = require('../config/redis');

// TODO: Import services
// const { notificationService } = require('../services/notificationService');
// const { query } = require('../config/database');

// Queue name
const QUEUE_NAME = 'digests';

/**
 * TODO: Initialize the digest worker
 */
const startWorker = () => {
  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      // TODO: Extract digest data from job
      // const { type, userId } = job.data; // type: 'daily' or 'weekly'
      
      // TODO: Implement job processing:
      // 1. Get all changes for user in time period
      // 2. Aggregate by watch
      // 3. Generate digest email content
      // 4. Send digest email
      
      console.log(`Processing digest job ${job.id}`);
      throw new Error('Worker not implemented');
    },
    {
      connection: redis,
      concurrency: 5, // Digests are less urgent, lower concurrency
    }
  );

  worker.on('completed', (job) => {
    console.log(`Digest job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Digest job ${job?.id} failed:`, err.message);
  });

  console.log('📅 Digest worker started');
  return worker;
};

module.exports = {
  QUEUE_NAME,
  startWorker,
};
