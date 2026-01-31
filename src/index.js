require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { errorHandler } = require('./middleware/errorHandler');

// Import routes
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const watchesRoutes = require('./routes/watches');
const changesRoutes = require('./routes/changes');
const billingRoutes = require('./routes/billing');
const webhooksRoutes = require('./routes/webhooks');
const feedbackRoutes = require('./routes/feedback');

// Initialize Express app
const app = express();

// Security middleware
app.use(helmet());

// CORS configuration - allow dashboard to make authenticated requests
const allowedOrigins = new Set([
  "http://localhost:3001",
  "http://localhost:3000",
  "http://localhost:5173",
  process.env.DASHBOARD_URL, // e.g. https://watchpoint-dashboard.vercel.app
  process.env.APP_URL,       // backward compatibility
].filter(Boolean));

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, server-to-server)
    if (!origin) return cb(null, true);
    return allowedOrigins.has(origin) ? cb(null, true) : cb(new Error("CORS blocked"), false);
  },
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
}));

// Body parsing middleware
// Note: webhooks route needs raw body for Stripe signature verification
app.use('/api/webhooks', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/watches', watchesRoutes);
app.use('/api/changes', changesRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/webhooks', webhooksRoutes);
app.use('/api/feedback', feedbackRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'WatchPoint API',
    version: '1.0.0',
    documentation: '/api/docs'
  });
});

// Global error handler (must be last)
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`WatchPoint API server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
