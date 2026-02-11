/
 * GovBid Scout API Server
 * Main entry point
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info('Request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
  });
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'govbid-scout-api', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/profiles', require('./routes/profiles')); // Opportunity profiles
app.use('/api/subscriptions', require('./routes/subscriptions')); // Source subscriptions
app.use('/api/opportunities', require('./routes/opportunities')); // Opportunities
app.use('/api/billing', require('./routes/billing'));
app.use('/api/webhooks', require('./routes/webhooks'));
app.use('/api/feedback', require('./routes/feedback'));

// Legacy WatchPoint routes (deprecated but kept for migration)
app.use('/api/watches', require('./routes/watches'));

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info('GovBid Scout API started', { port: PORT, env: process.env.NODE_ENV });
});

module.exports = app;