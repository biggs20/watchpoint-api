/
 * Source Subscription Routes
 * Manage profile-source subscriptions
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

// Get available sources
router.get('/sources', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, name, display_name, level, base_url, is_active, requires_subscription
       FROM procurement_sources
       WHERE is_active = true
       ORDER BY level, display_name`
    );

    res.json({ sources: result.rows });
  } catch (error) {
    logger.error('Error fetching sources', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch sources' });
  }
});

// Get subscriptions for a profile
router.get('/profile/:profileId', auth, async (req, res) => {
  try {
    // Verify profile ownership
    const profile = await db.query(
      'SELECT id FROM opportunity_profiles WHERE id = $1 AND user_id = $2',
      [req.params.profileId, req.user.id]
    );

    if (profile.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const result = await db.query(
      `SELECT ss.*, ps.name as source_name, ps.display_name, ps.level, ps.base_url
       FROM source_subscriptions ss
       JOIN procurement_sources ps ON ss.source_id = ps.id
       WHERE ss.profile_id = $1
       ORDER BY ps.level, ps.display_name`,
      [req.params.profileId]
    );

    res.json({ subscriptions: result.rows });
  } catch (error) {
    logger.error('Error fetching subscriptions', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

// Create/update subscription
router.post('/profile/:profileId/source/:sourceId', auth, async (req, res) => {
  try {
    // Verify profile ownership
    const profile = await db.query(
      'SELECT id FROM opportunity_profiles WHERE id = $1 AND user_id = $2',
      [req.params.profileId, req.user.id]
    );

    if (profile.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Verify source exists
    const source = await db.query(
      'SELECT id FROM procurement_sources WHERE id = $1 AND is_active = true',
      [req.params.sourceId]
    );

    if (source.rows.length === 0) {
      return res.status(404).json({ error: 'Source not found' });
    }

    const { is_enabled, config } = req.body;

    const result = await db.query(
      `INSERT INTO source_subscriptions (id, profile_id, source_id, is_enabled, config, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT (profile_id, source_id)
       DO UPDATE SET is_enabled = $4, config = COALESCE($5, source_subscriptions.config), updated_at = NOW()
       RETURNING *`,
      [
        uuidv4(),
        req.params.profileId,
        req.params.sourceId,
        is_enabled !== false,
        config ? JSON.stringify(config) : null,
      ]
    );

    logger.info('Subscription updated', {
      profileId: req.params.profileId,
      sourceId: req.params.sourceId,
      enabled: is_enabled !== false,
    });

    res.json({ subscription: result.rows[0] });
  } catch (error) {
    logger.error('Error updating subscription', { error: error.message });
    res.status(500).json({ error: 'Failed to update subscription' });
  }
});

// Delete subscription
router.delete('/profile/:profileId/source/:sourceId', auth, async (req, res) => {
  try {
    // Verify profile ownership
    const profile = await db.query(
      'SELECT id FROM opportunity_profiles WHERE id = $1 AND user_id = $2',
      [req.params.profileId, req.user.id]
    );

    if (profile.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    await db.query(
      'DELETE FROM source_subscriptions WHERE profile_id = $1 AND source_id = $2',
      [req.params.profileId, req.params.sourceId]
    );

    logger.info('Subscription deleted', {
      profileId: req.params.profileId,
      sourceId: req.params.sourceId,
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting subscription', { error: error.message });
    res.status(500).json({ error: 'Failed to delete subscription' });
  }
});

// Bulk enable/disable sources for a profile
router.post('/profile/:profileId/bulk', auth, async (req, res) => {
  try {
    // Verify profile ownership
    const profile = await db.query(
      'SELECT id FROM opportunity_profiles WHERE id = $1 AND user_id = $2',
      [req.params.profileId, req.user.id]
    );

    if (profile.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const { sources } = req.body; // Array of { source_id, is_enabled, config }

    if (!Array.isArray(sources)) {
      return res.status(400).json({ error: 'sources must be an array' });
    }

    const results = [];
    for (const src of sources) {
      const result = await db.query(
        `INSERT INTO source_subscriptions (id, profile_id, source_id, is_enabled, config, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         ON CONFLICT (profile_id, source_id)
         DO UPDATE SET is_enabled = $4, config = COALESCE($5, source_subscriptions.config), updated_at = NOW()
         RETURNING *`,
        [
          uuidv4(),
          req.params.profileId,
          src.source_id,
          src.is_enabled !== false,
          src.config ? JSON.stringify(src.config) : null,
        ]
      );
      results.push(result.rows[0]);
    }

    logger.info('Bulk subscriptions updated', {
      profileId: req.params.profileId,
      count: sources.length,
    });

    res.json({ subscriptions: results });
  } catch (error) {
    logger.error('Error bulk updating subscriptions', { error: error.message });
    res.status(500).json({ error: 'Failed to update subscriptions' });
  }
});

module.exports = router;