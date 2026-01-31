const express = require('express');
const router = express.Router();
const { authenticate, supabase } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { apiLimiter } = require('../middleware/rateLimiter');

router.use(authenticate);
router.use(apiLimiter);

/**
 * Validate URL format
 */
const isValidUrl = (string) => {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
};

/**
 * Get user's profile for plan enforcement
 */
const getUserProfile = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('plan_tier, watches_limit')
    .eq('id', userId)
    .single();
  
  if (error) {
    // Default to free tier if profile not found
    return { plan_tier: 'free', watches_limit: 5 };
  }
  return data;
};

/**
 * GET /api/watches
 * List all watches for the authenticated user with latest change summary
 */
router.get('/', asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const { data: watches, error } = await supabase
    .from('watches')
    .select(`
      id,
      name,
      target_url,
      is_active,
      check_interval_seconds,
      last_checked_at,
      next_check_at,
      created_at
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching watches:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch watches.'
    });
  }

  // Get latest change for each watch
  const watchesWithChanges = await Promise.all(
    (watches || []).map(async (watch) => {
      const { data: changes } = await supabase
        .from('changes')
        .select('id, change_type, change_summary, detected_at')
        .eq('watch_id', watch.id)
        .order('detected_at', { ascending: false })
        .limit(1);

      return {
        ...watch,
        latest_change: changes && changes.length > 0 ? changes[0] : null
      };
    })
  );

  res.json(watchesWithChanges);
}));

/**
 * POST /api/watches
 * Create a new watch
 */
router.post('/', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { 
    target_url, 
    name, 
    description, 
    check_interval_seconds, 
    selector, 
    auth_secret_ref 
  } = req.body;

  // Validate URL
  if (!target_url || !isValidUrl(target_url)) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Valid target_url (http/https) is required.'
    });
  }

  // Get user profile for plan enforcement
  const profile = await getUserProfile(userId);

  // Count existing watches
  const { count, error: countError } = await supabase
    .from('watches')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (countError) {
    console.error('Error counting watches:', countError);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to check watch limit.'
    });
  }

  // Check watch limit
  if (count >= profile.watches_limit) {
    return res.status(403).json({
      error: 'Forbidden',
      message: `Watch limit reached. Your plan allows ${profile.watches_limit} watches.`
    });
  }

  // Plan enforcement for free tier
  let finalInterval = check_interval_seconds || 86400;
  let finalAuthSecretRef = auth_secret_ref;

  if (profile.plan_tier === 'free') {
    // Free tier: min interval 86400 seconds (1 day)
    if (finalInterval < 86400) {
      finalInterval = 86400;
    }
    // Free tier: no auth_secret_ref
    if (finalAuthSecretRef) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Authentication for watches requires a paid plan.'
      });
    }
  }

  // Insert watch
  const { data: watch, error: insertError } = await supabase
    .from('watches')
    .insert({
      user_id: userId,
      target_url,
      name: name || target_url,
      description: description || null,
      check_interval_seconds: finalInterval,
      selector: selector || null,
      auth_secret_ref: finalAuthSecretRef || null,
      is_active: true,
      next_check_at: new Date().toISOString()
    })
    .select()
    .single();

  if (insertError) {
    console.error('Error creating watch:', insertError);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create watch.'
    });
  }

  res.status(201).json(watch);
}));

/**
 * GET /api/watches/:id
 * Get a specific watch with recent changes
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const watchId = req.params.id;

  // Get watch (must belong to user)
  const { data: watch, error } = await supabase
    .from('watches')
    .select('*')
    .eq('id', watchId)
    .eq('user_id', userId)
    .single();

  if (error || !watch) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Watch not found.'
    });
  }

  // Get last 20 changes
  const { data: changes } = await supabase
    .from('changes')
    .select('id, change_type, change_summary, diff_data, detected_at, notification_sent')
    .eq('watch_id', watchId)
    .order('detected_at', { ascending: false })
    .limit(20);

  res.json({
    ...watch,
    changes: changes || []
  });
}));

/**
 * PUT /api/watches/:id
 * Update a watch
 */
router.put('/:id', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const watchId = req.params.id;
  const { 
    name, 
    description, 
    selector, 
    check_interval_seconds, 
    auth_secret_ref, 
    is_active 
  } = req.body;

  // Verify ownership
  const { data: existingWatch, error: fetchError } = await supabase
    .from('watches')
    .select('is_active, check_interval_seconds')
    .eq('id', watchId)
    .eq('user_id', userId)
    .single();

  if (fetchError || !existingWatch) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Watch not found.'
    });
  }

  // Get user profile for plan enforcement
  const profile = await getUserProfile(userId);

  // Build update object
  const updates = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (selector !== undefined) updates.selector = selector;

  // Plan enforcement on interval
  if (check_interval_seconds !== undefined) {
    let interval = check_interval_seconds;
    if (profile.plan_tier === 'free' && interval < 86400) {
      interval = 86400;
    }
    updates.check_interval_seconds = interval;
  }

  // Plan enforcement on auth_secret_ref
  if (auth_secret_ref !== undefined) {
    if (profile.plan_tier === 'free' && auth_secret_ref) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Authentication for watches requires a paid plan.'
      });
    }
    updates.auth_secret_ref = auth_secret_ref;
  }

  if (is_active !== undefined) {
    updates.is_active = is_active;
  }

  // If is_active changed to true OR check_interval_seconds changed: set next_check_at=now()
  const activationChanged = is_active === true && existingWatch.is_active === false;
  const intervalChanged = check_interval_seconds !== undefined && 
                          check_interval_seconds !== existingWatch.check_interval_seconds;
  
  if (activationChanged || intervalChanged) {
    updates.next_check_at = new Date().toISOString();
  }

  // Update watch
  const { data: watch, error: updateError } = await supabase
    .from('watches')
    .update(updates)
    .eq('id', watchId)
    .eq('user_id', userId)
    .select()
    .single();

  if (updateError) {
    console.error('Error updating watch:', updateError);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update watch.'
    });
  }

  res.json(watch);
}));

/**
 * POST /api/watches/:id/pause
 * Pause a watch
 */
router.post('/:id/pause', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const watchId = req.params.id;

  const { data, error } = await supabase
    .from('watches')
    .update({ is_active: false })
    .eq('id', watchId)
    .eq('user_id', userId)
    .select('id')
    .single();

  if (error || !data) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Watch not found.'
    });
  }

  res.json({ success: true, is_active: false });
}));

/**
 * POST /api/watches/:id/resume
 * Resume a watch
 */
router.post('/:id/resume', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const watchId = req.params.id;

  const { data, error } = await supabase
    .from('watches')
    .update({ 
      is_active: true, 
      next_check_at: new Date().toISOString() 
    })
    .eq('id', watchId)
    .eq('user_id', userId)
    .select('id')
    .single();

  if (error || !data) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Watch not found.'
    });
  }

  res.json({ success: true, is_active: true });
}));

/**
 * DELETE /api/watches/:id
 * Delete a watch (cascades to snapshots, changes)
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const watchId = req.params.id;

  const { data, error } = await supabase
    .from('watches')
    .delete()
    .eq('id', watchId)
    .eq('user_id', userId)
    .select('id')
    .single();

  if (error || !data) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Watch not found.'
    });
  }

  res.json({ success: true });
}));

module.exports = router;
