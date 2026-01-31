const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// TODO: Import services
// const { billingService } = require('../services/billingService');

// Apply authentication to all billing routes
router.use(authenticate);

// GET /api/billing/subscription
// TODO: Get current subscription status
router.get('/subscription', asyncHandler(async (req, res) => {
  // TODO: Get subscription from Stripe
  // TODO: Return subscription details
  res.status(501).json({ message: 'Not implemented yet' });
}));

// POST /api/billing/checkout
// TODO: Create checkout session for subscription
router.post('/checkout', asyncHandler(async (req, res) => {
  // TODO: Validate plan selection
  // TODO: Create Stripe checkout session
  // TODO: Return checkout URL
  res.status(501).json({ message: 'Not implemented yet' });
}));

// POST /api/billing/portal
// TODO: Create billing portal session
router.post('/portal', asyncHandler(async (req, res) => {
  // TODO: Create Stripe portal session
  // TODO: Return portal URL
  res.status(501).json({ message: 'Not implemented yet' });
}));

// GET /api/billing/invoices
// TODO: Get invoice history
router.get('/invoices', asyncHandler(async (req, res) => {
  // TODO: Fetch invoices from Stripe
  res.status(501).json({ message: 'Not implemented yet' });
}));

// POST /api/billing/cancel
// TODO: Cancel subscription
router.post('/cancel', asyncHandler(async (req, res) => {
  // TODO: Cancel subscription at period end
  res.status(501).json({ message: 'Not implemented yet' });
}));

module.exports = router;
