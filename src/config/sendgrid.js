/**
 * SendGrid Configuration
 * Gracefully handles missing or invalid API key
 */

const sgMail = require('@sendgrid/mail');

// Configuration state
let isConfigured = false;
let sgClient = null;

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'alerts@watchpoint.io';

/**
 * Initialize SendGrid client
 * Returns false if key is missing/invalid - does NOT throw
 */
const initSendGrid = () => {
  // Check if API key is set and not a placeholder
  if (!SENDGRID_API_KEY || 
      SENDGRID_API_KEY === '' || 
      SENDGRID_API_KEY === 'placeholder' ||
      SENDGRID_API_KEY.length < 20) {
    console.warn('SendGrid not configured - SENDGRID_API_KEY missing or invalid');
    isConfigured = false;
    return false;
  }

  try {
    sgMail.setApiKey(SENDGRID_API_KEY);
    sgClient = sgMail;
    isConfigured = true;
    console.log('SendGrid initialized successfully');
    return true;
  } catch (error) {
    console.warn('SendGrid initialization failed:', error.message);
    isConfigured = false;
    return false;
  }
};

// Initialize on module load
initSendGrid();

/**
 * Get the SendGrid client (or null if not configured)
 */
const getClient = () => {
  return isConfigured ? sgClient : null;
};

/**
 * Check if SendGrid is properly configured
 */
const isSendGridConfigured = () => {
  return isConfigured;
};

/**
 * Get the from email address
 */
const getFromEmail = () => {
  return FROM_EMAIL;
};

module.exports = {
  getClient,
  isConfigured: isSendGridConfigured,
  getFromEmail,
  initSendGrid,
};
