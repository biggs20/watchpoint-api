const Stripe = require('stripe');

// Initialize Stripe client
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
  typescript: false,
});

// Verify Stripe webhook signature
const verifyWebhookSignature = (payload, signature) => {
  try {
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    return { valid: true, event };
  } catch (err) {
    console.error('⚠️ Webhook signature verification failed:', err.message);
    return { valid: false, error: err.message };
  }
};

module.exports = {
  stripe,
  verifyWebhookSignature,
};
