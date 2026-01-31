/**
 * Worker Entry Point
 * Starts all WatchPoint workers and schedulers
 */

require('dotenv').config();

const { startWorker: startMonitorWorker } = require('./workers/monitorWorker');
const { startWorker: startNotifyWorker } = require('./workers/notifyWorker');
const { startBackfillScheduler } = require('./workers/notifyBackfill');
const { initCron } = require('./workers/scheduler');

// Track workers for graceful shutdown
let monitorWorker = null;
let notifyWorker = null;
let backfillInterval = null;

/**
 * Start all workers
 */
const startAllWorkers = async () => {
  console.log('Starting WatchPoint workers...');
  
  // Start monitor worker
  monitorWorker = startMonitorWorker();
  console.log('Monitor worker started');
  
  // Start notify worker
  notifyWorker = startNotifyWorker();
  console.log('Notify worker started');
  
  // Start backfill scheduler
  backfillInterval = startBackfillScheduler();
  console.log('Notify backfill scheduler started');
  
  // Start cron scheduler
  initCron();
  console.log('Cron scheduler started');
  
  console.log('WatchPoint workers running (monitor + notify)');
};

/**
 * Graceful shutdown handler
 */
const gracefulShutdown = async (signal) => {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  
  // Clear backfill interval
  if (backfillInterval) {
    clearInterval(backfillInterval);
    console.log('Backfill scheduler stopped');
  }
  
  // Close workers
  if (monitorWorker) {
    await monitorWorker.close();
    console.log('Monitor worker closed');
  }
  
  if (notifyWorker) {
    await notifyWorker.close();
    console.log('Notify worker closed');
  }
  
  console.log('All workers shut down');
  process.exit(0);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
});

// Start workers
startAllWorkers().catch((error) => {
  console.error('Failed to start workers:', error);
  process.exit(1);
});
