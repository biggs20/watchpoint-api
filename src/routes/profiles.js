/
 * Opportunity Profile Routes
 * CRUD operations for user opportunity profiles
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

// Get all profiles for authenticated user
router.get('/', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT op.*, 
        (SELECT COUNT(*) FROM source_subscriptions ss WHERE ss.profile_id = op.id AND ss.is_enabled = true) as active_sources,
        (SELECT COUNT(*) FROM profile_opportunities po WHERE po.profile_id = op.id) as opportunity_count
       FROM opportunity_profiles op
       WHERE op.user_id = $1
       ORDER BY op.created_at DESC`,
      [req.user.id]
    );

    res.json({ profiles: result.rows });
  } catch (error) {
    logger.error('Error fetching profiles', { error: error.message, userId: req.user.id });
    res.status(500).json({ error: 'Failed to fetch profiles' });
  }
});

// Get single profile with details
router.get('/:id', auth, async (req, res) => {
  try {
    const profileResult = await db.query(
      'SELECT * FROM opportunity_profiles WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    if (profileResult.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const profile = profileResult.rows[0];

    // Get subscriptions
    const subsResult = await db.query(
      `SELECT ss.*, ps.name as source_name, ps.display_name, ps.level
       FROM source_subscriptions ss
       JOIN procurement_sources ps ON ss.source_id = ps.id
       WHERE ss.profile_id = $1`,
      [req.params.id]
    );

    // Get recent opportunities
    const oppsResult = await db.query(
      `SELECT o.*, po.fit_score
       FROM opportunities o
       JOIN profile_opportunities po ON o.id = po.opportunity_id
       WHERE po.profile_id = $1
       ORDER BY po.fit_score DESC, o.posted_at DESC
       LIMIT 20`,
      [req.params.id]
    );

    res.json({
      profile,
      subscriptions: subsResult.rows,
      opportunities: oppsResult.rows,
    });
  } catch (error) {
    logger.error('Error fetching profile', { error: error.message, profileId: req.params.id });
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Create new profile
router.post('/', auth, async (req, res) => {
  try {
    const {
      name,
      naics_codes,
      keywords_include,
      keywords_exclude,
      set_asides,
      states,
      levels,
      value_min,
      value_max,
      run_interval_minutes,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Profile name is required' });
    }

    const id = uuidv4();
    const now = new Date();
    const nextRun = new Date(now.getTime() + 60000); // First run in 1 minute

    const result = await db.query(
      `INSERT INTO opportunity_profiles (
        id, user_id, name, naics_codes, keywords_include, keywords_exclude,
        set_asides, states, levels, value_min, value_max,
        run_interval_minutes, is_active, next_run_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true, $13, NOW(), NOW())
      RETURNING *`,
      [
        id,
        req.user.id,
        name,
        naics_codes || [],
        keywords_include || [],
        keywords_exclude || [],
        set_asides || [],
        states || [],
        levels || ['federal', 'state_local'],
        value_min || null,
        value_max || null,
        run_interval_minutes || 60,
        nextRun,
      ]
    );

    logger.info('Profile created', { profileId: id, userId: req.user.id, name });

    res.status(201).json({ profile: result.rows[0] });
  } catch (error) {
    logger.error('Error creating profile', { error: error.message, userId: req.user.id });
    res.status(500).json({ error: 'Failed to create profile' });
  }
});

// Update profile
router.put('/:id', auth, async (req, res) => {
  try {
    // Verify ownership
    const existing = await db.query(
      'SELECT id FROM opportunity_profiles WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const {
      name,
      naics_codes,
      keywords_include,
      keywords_exclude,
      set_asides,
      states,
      levels,
      value_min,
      value_max,
      run_interval_minutes,
      is_active,
    } = req.body;

    const result = await db.query(
      `UPDATE opportunity_profiles SET
        name = COALESCE($1, name),
        naics_codes = COALESCE($2, naics_codes),
        keywords_include = COALESCE($3, keywords_include),
        keywords_exclude = COALESCE($4, keywords_exclude),
        set_asides = COALESCE($5, set_asides),
        states = COALESCE($6, states),
        levels = COALESCE($7, levels),
        value_min = COALESCE($8, value_min),
        value_max = COALESCE($9, value_max),
        run_interval_minutes = COALESCE($10, run_interval_minutes),
        is_active = COALESCE($11, is_active),
        updated_at = NOW()
      WHERE id = $12
      RETURNING *`,
      [
        name,
        naics_codes,
        keywords_include,
        keywords_exclude,
        set_asides,
        states,
        levels,
        value_min,
        value_max,
        run_interval_minutes,
        is_active,
        req.params.id,
      ]
    );

    logger.info('Profile updated', { profileId: req.params.id, userId: req.user.id });

    res.json({ profile: result.rows[0] });
  } catch (error) {
    logger.error('Error updating profile', { error: error.message, profileId: req.params.id });
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Delete profile
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM opportunity_profiles WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    logger.info('Profile deleted', { profileId: req.params.id, userId: req.user.id });

    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting profile', { error: error.message, profileId: req.params.id });
    res.status(500).json({ error: 'Failed to delete profile' });
  }
});

// Trigger manual run
router.post('/:id/run', auth, async (req, res) => {
  try {
    const existing = await db.query(
      'SELECT id FROM opportunity_profiles WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const { profileQueue } = require('../worker');
    await profileQueue.add('manual-run', { profileId: req.params.id });

    logger.info('Manual profile run triggered', { profileId: req.params.id, userId: req.user.id });

    res.json({ success: true, message: 'Profile run queued' });
  } catch (error) {
    logger.error('Error triggering profile run', { error: error.message, profileId: req.params.id });
    res.status(500).json({ error: 'Failed to trigger profile run' });
  }
});

module.exports = router;