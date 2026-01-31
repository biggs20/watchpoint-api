const Redis = require('ioredis');

// Create Redis client
const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false,
  retryStrategy: (times) => {
    if (times > 3) {
      console.error('❌ Redis connection failed after 3 retries');
      return null; // Stop retrying
    }
    return Math.min(times * 200, 2000); // Exponential backoff
  },
});

redis.on('connect', () => {
  console.log('🔴 Connected to Redis');
});

redis.on('error', (err) => {
  console.error('❌ Redis error:', err.message);
});

redis.on('reconnecting', () => {
  console.log('🔄 Reconnecting to Redis...');
});

// Helper functions for common operations
const cache = {
  // Get cached value
  async get(key) {
    const value = await redis.get(key);
    return value ? JSON.parse(value) : null;
  },
  
  // Set cached value with optional TTL (in seconds)
  async set(key, value, ttlSeconds = 3600) {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  },
  
  // Delete cached value
  async del(key) {
    await redis.del(key);
  },
  
  // Check if key exists
  async exists(key) {
    return await redis.exists(key);
  },
  
  // Get all keys matching pattern
  async keys(pattern) {
    return await redis.keys(pattern);
  },
  
  // Increment a counter
  async incr(key) {
    return await redis.incr(key);
  },
  
  // Set expiration on existing key
  async expire(key, ttlSeconds) {
    return await redis.expire(key, ttlSeconds);
  },
};

module.exports = {
  redis,
  cache,
};
