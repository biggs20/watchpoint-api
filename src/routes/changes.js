const express = require('express');
const router = express.Router();
const { authenticate, supabase } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { apiLimiter } = require('../middleware/rateLimiter');

router.use(authenticate);
router.use(apiLimiter);

/**
 * GET /api/changes/recent
 * Get recent changes across all user's watches
 */
router.get('/recent', asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // First get all watch_ids for user
  const { data: watches, error: watchesError } = await supabase
    .from('watches')
    .select('id, name, target_url')
    .eq('user_id', userId);

  if (watchesError) {
    console.error('Error fetching watches:', watchesError);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch watches.'
    });
  }

  if (!watches || watches.length === 0) {
    return res.json([]);
  }

  // Create a map of watch_id -> watch info
  const watchMap = {};
  watches.forEach(w => {
    watchMap[w.id] = { name: w.name, target_url: w.target_url };
  });

  const watchIds = watches.map(w => w.id);

  // Get last 50 changes across all watches
  const { data: changes, error: changesError } = await supabase
    .from('changes')
    .select('id, watch_id, change_type, change_summary, diff_data, detected_at, notification_sent')
    .in('watch_id', watchIds)
    .order('detected_at', { ascending: false })
    .limit(50);

  if (changesError) {
    console.error('Error fetching changes:', changesError);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch changes.'
    });
  }

  // Enrich changes with watch info
  const enrichedChanges = (changes || []).map(change => ({
    ...change,
    watch_name: watchMap[change.watch_id]?.name,
    watch_target_url: watchMap[change.watch_id]?.target_url
  }));

  res.json(enrichedChanges);
}));

module.exports = router;
