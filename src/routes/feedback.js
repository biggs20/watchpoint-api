const express = require('express');
const router = express.Router();
const { authenticate, supabase } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { apiLimiter } = require('../middleware/rateLimiter');

router.use(authenticate);
router.use(apiLimiter);

/**
 * POST /api/feedback/:changeId
 * Submit feedback for a change (noise, useful, critical)
 */
router.post('/:changeId', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const changeId = req.params.changeId;
  const { feedback } = req.body;

  // Validate feedback value
  const validFeedback = ['noise', 'useful', 'critical'];
  if (!feedback || !validFeedback.includes(feedback)) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Feedback must be one of: noise, useful, critical'
    });
  }

  // Verify change belongs to a watch owned by user
  const { data: change, error: changeError } = await supabase
    .from('changes')
    .select('id, watch_id')
    .eq('id', changeId)
    .single();

  if (changeError || !change) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Change not found.'
    });
  }

  // Verify watch ownership
  const { data: watch, error: watchError } = await supabase
    .from('watches')
    .select('id')
    .eq('id', change.watch_id)
    .eq('user_id', userId)
    .single();

  if (watchError || !watch) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You do not have permission to provide feedback for this change.'
    });
  }

  // Insert/update feedback (upsert on unique constraint change_id + user_id)
  const { error: insertError } = await supabase
    .from('change_feedback')
    .upsert({
      change_id: changeId,
      user_id: userId,
      feedback: feedback
    }, {
      onConflict: 'change_id,user_id'
    });

  if (insertError) {
    console.error('Error inserting feedback:', insertError);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to save feedback.'
    });
  }

  // Log for future noise filter learning
  if (feedback === 'noise') {
    console.log('TODO: feed into noiseFilter learning', {
      changeId,
      userId,
      feedback
    });
  }

  res.json({ success: true });
}));

module.exports = router;
