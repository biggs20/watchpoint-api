/
 * Delaware MarketLink Adapter
 * Scrapes Delaware state procurement opportunities
 */

const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../utils/logger');

const DE_MARKETLINK_URL = 'https://marketlink.delaware.gov';
const DE_BIDS_URL = 'https://marketlink.delaware.gov/apps/bids/';

/
 * Normalize Delaware MarketLink opportunity to our schema
 * @param {Object} rawOpp - Scraped opportunity data
 * @param {string} sourceId - The procurement_sources.id
 * @returns {Object} - Normalized opportunity
 */
function normalizeOpportunity(rawOpp, sourceId) {
  return {
    source_id: sourceId,
    external_id: rawOpp.bidId,
    title: rawOpp.title || 'Untitled DE Opportunity',
    description: rawOpp.description || null,
    buyer: rawOpp.agency || 'State of Delaware',
    naics: null,
    set_aside: null,
    value_min: null,
    value_max: null,
    posted_at: rawOpp.postedDate ? new Date(rawOpp.postedDate) : new Date(),
    response_due_at: rawOpp.dueDate ? new Date(rawOpp.dueDate) : null,
    url: rawOpp.url || DE_MARKETLINK_URL,
    level: 'state_local',
    state: 'DE',
    raw_data: rawOpp,
  };
}

/
 * Parse date from various formats
 */
function parseDate(dateStr) {
  if (!dateStr) return null;
  const cleaned = dateStr.trim();
  const parsed = new Date(cleaned);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/
 * Extract opportunities from Delaware MarketLink HTML
 */
function parseOpportunities(html, sourceId) {
  const $ = cheerio.load(html);
  const opportunities = [];

  // MarketLink bid listings
  $('table tr, .bid-row, .procurement-item, [class*="bid"]').each((index, element) => {
    const $el = $(element);
    
    // Skip header rows
    if ($el.find('th').length > 0) return;
    if (index === 0 && $el.closest('table').length) return;

    try {
      // Try to extract from table cells
      const cells = $el.find('td');
      let bidId, title, agency, dueDate, url;

      if (cells.length >= 3) {
        bidId = $(cells[0]).text().trim();
        title = $(cells[1]).text().trim();
        agency = $(cells[2]).text().trim();
        dueDate = cells.length > 3 ? $(cells[3]).text().trim() : null;
        
        const link = $el.find('a').first().attr('href');
        url = link ? new URL(link, DE_MARKETLINK_URL).href : null;
      } else {
        // Try alternative structure
        bidId = $el.find('[class*="id"], [class*="number"]').text().trim();
        title = $el.find('[class*="title"], h3, h4').text().trim();
        agency = $el.find('[class*="agency"], [class*="department"]').text().trim();
        dueDate = $el.find('[class*="date"], [class*="deadline"]').text().trim();
        url = $el.find('a').first().attr('href');
        if (url) url = new URL(url, DE_MARKETLINK_URL).href;
      }

      if (bidId || title) {
        opportunities.push(normalizeOpportunity({
          bidId: bidId || `DE-${Date.now()}-${index}`,
          title: title || 'Delaware Procurement Opportunity',
          agency,
          dueDate: parseDate(dueDate),
          url,
        }, sourceId));
      }
    } catch (err) {
      logger.warn('Error parsing DE row', { index, error: err.message });
    }
  });

  return opportunities;
}

/
 * Fetch opportunities from Delaware MarketLink
 * @param {Object} profile - The opportunity_profile with filters
 * @param {Object} source - The procurement_source record
 * @param {Object} subscription - The source_subscription with config
 * @returns {Promise<Object[]>} - Array of normalized opportunities
 */
async function fetchOpportunities(profile, source, subscription) {
  try {
    logger.info('Fetching Delaware MarketLink opportunities', {
      profileId: profile.id,
    });

    // Try the main bids page
    const response = await axios.get(DE_BIDS_URL, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });

    let opportunities = parseOpportunities(response.data, source.id);

    // Apply profile keyword filters
    if (profile.keywords_include && profile.keywords_include.length > 0) {
      opportunities = opportunities.filter(opp => {
        const text = `${opp.title} ${opp.description || ''}`.toLowerCase();
        return profile.keywords_include.some(kw => text.includes(kw.toLowerCase()));
      });
    }

    if (profile.keywords_exclude && profile.keywords_exclude.length > 0) {
      opportunities = opportunities.filter(opp => {
        const text = `${opp.title} ${opp.description || ''}`.toLowerCase();
        return !profile.keywords_exclude.some(kw => text.includes(kw.toLowerCase()));
      });
    }

    logger.info('Delaware MarketLink fetch complete', {
      total: opportunities.length,
      profileId: profile.id,
    });

    return opportunities;

  } catch (error) {
    logger.error('Delaware MarketLink scrape error', {
      error: error.message,
      profileId: profile.id,
    });
    throw error;
  }
}

module.exports = fetchOpportunities;