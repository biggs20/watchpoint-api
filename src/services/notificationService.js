/**
 * Notification Service
 * Handles sending notifications via email, SMS, etc.
 */

// TODO: Import dependencies
// const { sendEmail } = require('../config/sendgrid');
// const { sendSMS } = require('../config/twilio');
// const { query } = require('../config/database');

/**
 * TODO: Send change notification
 * @param {string} userId
 * @param {Object} watch - the watch that detected a change
 * @param {Object} change - change details
 */
const notifyChange = async (userId, watch, change) => {
  // TODO: Get user's notification preferences
  // TODO: Send email if enabled
  // TODO: Send SMS if enabled
  // TODO: Log notification sent
  throw new Error('Not implemented');
};

/**
 * TODO: Send email notification
 * @param {string} email
 * @param {Object} watch
 * @param {Object} change
 */
const sendChangeEmail = async (email, watch, change) => {
  // TODO: Build email template
  // TODO: Include change summary and diff link
  // TODO: Send via SendGrid
  throw new Error('Not implemented');
};

/**
 * TODO: Send SMS notification
 * @param {string} phone
 * @param {Object} watch
 * @param {Object} change
 */
const sendChangeSMS = async (phone, watch, change) => {
  // TODO: Build concise SMS message
  // TODO: Send via Twilio
  throw new Error('Not implemented');
};

/**
 * TODO: Send daily digest
 * @param {string} userId
 * @param {Array} changes - array of changes from the day
 */
const sendDailyDigest = async (userId, changes) => {
  // TODO: Aggregate changes by watch
  // TODO: Build digest email
  // TODO: Send via SendGrid
  throw new Error('Not implemented');
};

/**
 * TODO: Send weekly digest
 * @param {string} userId
 * @param {Array} changes - array of changes from the week
 */
const sendWeeklyDigest = async (userId, changes) => {
  // TODO: Similar to daily digest but weekly
  throw new Error('Not implemented');
};

module.exports = {
  notifyChange,
  sendChangeEmail,
  sendChangeSMS,
  sendDailyDigest,
  sendWeeklyDigest,
};
