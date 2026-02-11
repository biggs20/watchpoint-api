/
 * WatchPoint Scrape Adapter (Fallback)
 * Uses existing WatchPoint diff engine for arbitrary URL monitoring
 * Creates opportunities from detected changes
 */

const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');
const diffEngine = require('../utils/diffEngine');
const logger = require('../utils/logger');
const db = require('../config/database');

/
 * Normalize scraped content to opportunity schema
 */
function normalizeOpportunity(scrapeResult, sourceId, config) {
  const now = new Date();
  
  return {
    source_id: sourceId,
    external_id: 'wp-' + Buffer.from(scrapeResult.url).toString('base64').slice(0, 32),
    title: scrapeResult.title || extractTitle(scrapeResult.content) || 'Monitored Page Update',
    description: scrapeResult.summary || truncate(scrapeResult.content, 500),
    buyer: config.buyer || extractBuyer(scrapeResult.url) || 'Unknown',
    naics: config.naics || null,
    set_aside: null,
    value_min: null,
    value_max: null,
    posted_at: now,
    response_due_at: scrapeResult.dueDate || null,
    url: scrapeResult.url,
    level: config.level || 'state_local',
    state: config.state || null,
    raw_data: {
      content: truncate(scrapeResult.content, 10000),
      diff: scrapeResult.diff,
      scrapeTimestamp: now.toISOString(),
    },
  };
}

function extractTitle(content) {
  if (!content) return null;
  const headingMatch = content.match(/<h[1-3][^>]*>([^<]+)<\/h[1-3]>/i);
  if (headingMatch) return headingMatch[1].trim();
  const textMatch = content.match(/^[^<]*|>([^<]{10,100})</);
  if (textMatch) return (textMatch[1] || textMatch[0]).trim().slice(0, 100);
  return null;
}

function extractBuyer(url) {
  try {
    const hostname = new URL(url).hostname;
    const name = hostname.replace(/^www\./, '').replace(/\.(gov|org|com|net|edu).*$/, '');
    return name.split('.').map(part => 
      part.charAt(0).toUpperCase() + part.slice(1)
    ).join(' ');
  } catch {
    return null;
  }
}

function truncate(str, maxLength) {
  if (!str) return null;
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

async function getPreviousSnapshot(url, profileId) {
  try {
    const result = await db.query(
      'SELECT content_hash, content FROM opportunity_snapshots WHERE url = $1 AND profile_id = $2 ORDER BY created_at DESC LIMIT 1',
      [url, profileId]
    );
    return result.rows[0] || null;
  } catch (error) {
    return null;
  }
}

async function saveSnapshot(url, profileId, content, contentHash) {
  try {
    await db.query(
      'INSERT INTO opportunity_snapshots (url, profile_id, content, content_hash, created_at) VALUES ($1, $2, $3, $4, NOW()) ON CONFLICT (url, profile_id) DO UPDATE SET content = $3, content_hash = $4, created_at = NOW()',
      [url, profileId, truncate(content, 50000), contentHash]
    );
  } catch (error) {
    logger.warn('Could not save snapshot', { error: error.message });
  }
}

async function scrapeUrl(url, profileId, config) {
  try {
    const response = await axios.get(url, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WatchPoint/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      maxRedirects: 5,
    });

    const $ = cheerio.load(response.data);
    $('script, style, nav, footer, header').remove();
    const textContent = $('body').text().replace(/\s+/g, ' ').trim();
    const title = $('title').text().trim() || $('h1').first().text().trim();

    const contentHash = crypto.createHash('md5').update(textContent).digest('hex');
    const previous = await getPreviousSnapshot(url, profileId);
    
    let diff = null;
    let isNew = false;
    let hasChanged = false;

    if (!previous) {
      isNew = true;
      hasChanged = true;
    } else if (previous.content_hash !== contentHash) {
      hasChanged = true;
      if (diffEngine && diffEngine.computeDiff) {
        diff = diffEngine.computeDiff(previous.content || '', textContent);
      } else {
        diff = { changed: true, summary: 'Content changed' };
      }
    }

    await saveSnapshot(url, profileId, textContent, contentHash);

    return { url, title, content: textContent, contentHash, diff, isNew, hasChanged };
  } catch (error) {
    logger.error('Scrape failed', { url, error: error.message });
    return { url, error: error.message, hasChanged: false };
  }
}

async function fetchOpportunities(profile, source, subscription) {
  const config = subscription.config || {};
  const urls = config.urls || [];
  
  if (urls.length === 0) {
    logger.warn('WatchPoint scrape adapter called with no URLs configured', {
      profileId: profile.id,
      subscriptionId: subscription.id,
    });
    return [];
  }

  logger.info('Running WatchPoint scrape', { profileId: profile.id, urlCount: urls.length });

  const opportunities = [];

  for (const urlConfig of urls) {
    const url = typeof urlConfig === 'string' ? urlConfig : urlConfig.url;
    const urlOptions = typeof urlConfig === 'object' ? urlConfig : {};

    const scrapeResult = await scrapeUrl(url, profile.id, urlOptions);

    if (scrapeResult.hasChanged && !scrapeResult.error) {
      const opportunity = normalizeOpportunity(scrapeResult, source.id, { ...config, ...urlOptions });
      const text = (opportunity.title + ' ' + (opportunity.description || '')).toLowerCase();
      
      let includeOpp = true;
      
      if (profile.keywords_include && profile.keywords_include.length > 0) {
        includeOpp = profile.keywords_include.some(kw => text.includes(kw.toLowerCase()));
      }
      
      if (includeOpp && profile.keywords_exclude && profile.keywords_exclude.length > 0) {
        includeOpp = !profile.keywords_exclude.some(kw => text.includes(kw.toLowerCase()));
      }

      if (includeOpp) {
        opportunities.push(opportunity);
      }
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  logger.info('WatchPoint scrape complete', { profileId: profile.id, total: opportunities.length });
  return opportunities;
}

module.exports = fetchOpportunities;