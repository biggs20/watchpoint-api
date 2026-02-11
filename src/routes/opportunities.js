/
 * Opportunity Routes
 * View and manage discovered opportunities
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');

// Get opportunities for a profile
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

    const { limit = 50, offset = 0, min_score = 0, sort = 'score' } = req.query;

    const orderBy = sort === 'date' ? 'o.posted_at DESC' : 'po.fit_score DESC NULLS LAST, o.posted_at DESC';

    const result = await db.query(
      `SELECT o.*, po.fit_score, ps.name as source_name, ps.display_name as source_display_name
       FROM opportunities o
       JOIN profile_opportunities po ON o.id = po.opportunity_id
       JOIN procurement_sources ps ON o.source_id = ps.id
       WHERE po.profile_id = $1
       AND (po.fit_score >= $2 OR po.fit_score IS NULL)
       ORDER BY ${orderBy}
       LIMIT $3 OFFSET $4`,
      [req.params.profileId, parseInt(min_score), parseInt(limit), parseInt(offset)]
    );

    const countResult = await db.query(
      `SELECT COUNT(*) as total
       FROM profile_opportunities po
       WHERE po.profile_id = $1
       AND (po.fit_score >= $2 OR po.fit_score IS NULL)`,
      [req.params.profileId, parseInt(min_score)]
    );

    res.json({
      opportunities: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    logger.error('Error fetching opportunities', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch opportunities' });
  }
});

// Get single opportunity details
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT o.*, ps.name as source_name, ps.display_name as source_display_name
       FROM opportunities o
       JOIN procurement_sources ps ON o.source_id = ps.id
       WHERE o.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Opportunity not found' });
    }

    // Get fit scores for all user's profiles
    const scoresResult = await db.query(
      `SELECT po.fit_score, op.id as profile_id, op.name as profile_name
       FROM profile_opportunities po
       JOIN opportunity_profiles op ON po.profile_id = op.id
       WHERE po.opportunity_id = $1 AND op.user_id = $2`,
      [req.params.id, req.user.id]
    );

    // Get events for this opportunity
    const eventsResult = await db.query(
      `SELECT e.*, op.name as profile_name
       FROM opportunity_events e
       JOIN opportunity_profiles op ON e.profile_id = op.id
       WHERE e.opportunity_id = $1 AND op.user_id = $2
       ORDER BY e.created_at DESC
       LIMIT 20`,
      [req.params.id, req.user.id]
    );

    res.json({
      opportunity: result.rows[0],
      profile_scores: scoresResult.rows,
      events: eventsResult.rows,
    });
  } catch (error) {
    logger.error('Error fetching opportunity', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch opportunity' });
  }
});

// Search opportunities across all user's profiles
router.get('/search', auth, async (req, res) => {
  try {
    const { q, min_score = 0, limit = 50, offset = 0 } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Search query required' });
    }

    const searchTerm = '%' + q + '%';

    const result = await db.query(
      `SELECT DISTINCT o.*, MAX(po.fit_score) as fit_score
       FROM opportunities o
       JOIN profile_opportunities po ON o.id = po.opportunity_id
       JOIN opportunity_profiles op ON po.profile_id = op.id
       WHERE op.user_id = $1
       AND (o.title ILIKE $2 OR o.description ILIKE $2 OR o.buyer ILIKE $2)
       AND (po.fit_score >= $3 OR po.fit_score IS NULL)
       GROUP BY o.id
       ORDER BY MAX(po.fit_score) DESC NULLS LAST, o.posted_at DESC
       LIMIT $4 OFFSET $5`,
      [req.user.id, searchTerm, parseInt(min_score), parseInt(limit), parseInt(offset)]
    );

    res.json({
      opportunities: result.rows,
      query: q,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    logger.error('Error searching opportunities', { error: error.message });
    res.status(500).json({ error: 'Failed to search opportunities' });
  }
});

// Get opportunity events/activity feed
router.get('/events/feed', auth, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const result = await db.query(
      `SELECT e.*, o.title, o.url, o.buyer, op.name as profile_name
       FROM opportunity_events e
       JOIN opportunities o ON e.opportunity_id = o.id
       JOIN opportunity_profiles op ON e.profile_id = op.id
       WHERE op.user_id = $1
       ORDER BY e.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, parseInt(limit), parseInt(offset)]
    );

    res.json({
      events: result.rows,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    logger.error('Error fetching events', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

module.exports = router;