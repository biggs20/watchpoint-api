const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

// JWT Authentication Middleware
const authenticate = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No token provided. Please include Authorization header with Bearer token.',
      });
    }

    const token = authHeader.split(' ')[1];

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: 'Token Expired',
          message: 'Your session has expired. Please log in again.',
        });
      }
      if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({
          error: 'Invalid Token',
          message: 'Token is malformed or invalid.',
        });
      }
      throw jwtError;
    }

    // Fetch user from database to ensure they still exist and are active
    const result = await query(
      'SELECT id, email, subscription_tier, subscription_status, created_at FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'User Not Found',
        message: 'User associated with this token no longer exists.',
      });
    }

    const user = result.rows[0];

    // Check if user account is active (not suspended/deleted)
    if (user.subscription_status === 'suspended') {
      return res.status(403).json({
        error: 'Account Suspended',
        message: 'Your account has been suspended. Please contact support.',
      });
    }

    // Attach user to request object for use in route handlers
    req.user = {
      id: user.id,
      email: user.email,
      subscriptionTier: user.subscription_tier,
      subscriptionStatus: user.subscription_status,
      createdAt: user.created_at,
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({
      error: 'Authentication Error',
      message: 'An error occurred while authenticating your request.',
    });
  }
};

// Optional authentication - doesn't fail if no token, just doesn't set req.user
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(); // Continue without authentication
  }

  // If token is provided, validate it
  return authenticate(req, res, next);
};

// Generate JWT token for user
const generateToken = (userId, email) => {
  return jwt.sign(
    { userId, email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Generate refresh token with longer expiry
const generateRefreshToken = (userId) => {
  return jwt.sign(
    { userId, type: 'refresh' },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
};

// Verify refresh token
const verifyRefreshToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== 'refresh') {
      return { valid: false, error: 'Invalid token type' };
    }
    return { valid: true, userId: decoded.userId };
  } catch (error) {
    return { valid: false, error: error.message };
  }
};

module.exports = {
  authenticate,
  optionalAuth,
  generateToken,
  generateRefreshToken,
  verifyRefreshToken,
};
