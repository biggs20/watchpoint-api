const express = require('express');
const router = express.Router();
const { authenticate, supabase } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { apiLimiter } = require('../middleware/rateLimiter');

router.use(apiLimiter);

/**
 * GET /api/me
 * Get current user's profile (auto-creates if missing)
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const userEmail = req.user.email;

  // Try to get existing profile
  let { data: profile, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, plan_tier, watches_limit, created_at')
    .eq('id', userId)
    .single();

  if (error && error.code === 'PGRST116') {
    // Profile doesn't exist, create minimal one
    const { data: newProfile, error: insertError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        email: userEmail
      })
      .select('id, email, full_name, plan_tier, watches_limit, created_at')
      .single();

    if (insertError) {
      console.error('Error creating profile:', insertError);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to create user profile.'
      });
    }

    profile = newProfile;
  } else if (error) {
    console.error('Error fetching profile:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch user profile.'
    });
  }

  res.json(profile);
}));

module.exports = router;
