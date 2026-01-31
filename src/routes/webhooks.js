const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const { webhookLimiter } = require('../middleware/rateLimiter');

// TODO: Import services
// const { billingService } = require('../services/billingService');
// const { verifyWebhookSignature } = require('../config/stripe');

// Apply webhook rate limiter
router.use(webhookLimiter);

// POST /api/webhooks/stripe
// TODO: Handle Stripe webhooks
router.post('/stripe', asyncHandler(async (req, res) => {
  // TODO: Verify Stripe signature
  // TODO: Handle event types:
  //   - checkout.session.completed
  //   - customer.subscription.created
  //   - customer.subscription.updated
  //   - customer.subscription.deleted
  //   - invoice.paid
  //   - invoice.payment_failed
  res.status(501).json({ message: 'Not implemented yet' });
}));

module.exports = router;
