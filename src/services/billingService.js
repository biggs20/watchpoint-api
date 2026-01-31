/**
 * Billing Service
 * Handles Stripe integration and subscription management
 */

// TODO: Import dependencies
// const { stripe } = require('../config/stripe');
// const { query } = require('../config/database');

// Subscription tier limits
const TIER_LIMITS = {
  free: { watches: 3, checkInterval: 'daily' },
  starter: { watches: 10, checkInterval: 'hourly' },
  pro: { watches: 50, checkInterval: '15min' },
  enterprise: { watches: 500, checkInterval: '5min' },
};

/**
 * TODO: Create Stripe customer for new user
 * @param {string} userId
 * @param {string} email
 * @returns {string} - Stripe customer ID
 */
const createCustomer = async (userId, email) => {
  // TODO: Create Stripe customer
  // TODO: Store customer ID in database
  throw new Error('Not implemented');
};

/**
 * TODO: Create checkout session for subscription
 * @param {string} userId
 * @param {string} planId
 * @returns {Object} - { sessionId, url }
 */
const createCheckoutSession = async (userId, planId) => {
  // TODO: Get user's Stripe customer ID
  // TODO: Create Stripe checkout session
  throw new Error('Not implemented');
};

/**
 * TODO: Create billing portal session
 * @param {string} userId
 * @returns {Object} - { url }
 */
const createPortalSession = async (userId) => {
  // TODO: Get user's Stripe customer ID
  // TODO: Create portal session
  throw new Error('Not implemented');
};

/**
 * TODO: Get user's current subscription
 * @param {string} userId
 * @returns {Object} - subscription details
 */
const getSubscription = async (userId) => {
  // TODO: Get subscription from Stripe
  // TODO: Return formatted subscription data
  throw new Error('Not implemented');
};

/**
 * TODO: Handle subscription updated webhook
 * @param {Object} subscription - Stripe subscription object
 */
const handleSubscriptionUpdated = async (subscription) => {
  // TODO: Update user's subscription tier in database
  // TODO: Adjust watch limits if downgraded
  throw new Error('Not implemented');
};

/**
 * TODO: Handle subscription deleted webhook
 * @param {Object} subscription - Stripe subscription object
 */
const handleSubscriptionDeleted = async (subscription) => {
  // TODO: Downgrade user to free tier
  // TODO: Pause excess watches
  throw new Error('Not implemented');
};

/**
 * TODO: Check if user can create more watches
 * @param {string} userId
 * @returns {Object} - { canCreate, currentCount, limit }
 */
const checkWatchLimit = async (userId) => {
  // TODO: Get user's subscription tier
  // TODO: Count current watches
  // TODO: Compare with tier limit
  throw new Error('Not implemented');
};

module.exports = {
  TIER_LIMITS,
  createCustomer,
  createCheckoutSession,
  createPortalSession,
  getSubscription,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  checkWatchLimit,
};
