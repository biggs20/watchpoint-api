/
 * PA eMarketplace Adapter
 * Scrapes Pennsylvania state procurement opportunities
 */

const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../utils/logger');

const PA_EMARKETPLACE_URL = 'https://www.emarketplace.state.pa.us/BidSearch.aspx';

/
 * Normalize PA eMarketplace opportunity to our schema
 * @param {Object} rawOpp - Scraped opportunity data
 * @param {string} sourceId - The procurement_sources.id
 * @returns {Object} - Normalized opportunity
 */
function normalizeOpportunity(rawOpp, sourceId) {
  return {
    source_id: sourceId,
    external_id: rawOpp.bidId,
    title: rawOpp.title || 'Untitled PA Opportunity',
    description: rawOpp.description || null,
    buyer: rawOpp.agency || 'Commonwealth of Pennsylvania',
    naics: null, // PA doesn't always provide NAICS
    set_aside: null,
    value_min: null,
    value_max: null,
    posted_at: rawOpp.postedDate ? new Date(rawOpp.postedDate) : new Date(),
    response_due_at: rawOpp.dueDate ? new Date(rawOpp.dueDate) : null,
    url: rawOpp.url || PA_EMARKETPLACE_URL,
    level: 'state_local',
    state: 'PA',
    raw_data: rawOpp,
  };
}

/
 * Parse date from PA format (various formats possible)
 */
function parseDate(dateStr) {
  if (!dateStr) return null;
  
  // Try common formats
  const cleaned = dateStr.trim();
  const parsed = new Date(cleaned);
  
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }
  
  // Try MM/DD/YYYY format
  const match = cleaned.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) {
    return new Date(match[3], match[1] - 1, match[2]);
  }
  
  return null;
}

/
 * Extract opportunities from PA eMarketplace HTML
 * @param {string} html - The page HTML
 * @param {string} sourceId - The procurement_sources.id
 * @returns {Object[]} - Array of normalized opportunities
 */
function parseOpportunities(html, sourceId) {
  const $ = cheerio.load(html);
  const opportunities = [];

  // PA eMarketplace uses a DataGrid table
  // Look for bid listing table rows
  $('table[id*="BidList"] tr, table.DataGrid tr, #gvBids tr').each((index, row) => {
    // Skip header row
    if (index === 0 || $(row).find('th').length > 0) return;

    const cells = $(row).find('td');
    if (cells.length < 3) return;

    try {
      // Extract data from cells (structure may vary)
      const bidId = $(cells[0]).text().trim();
      const title = $(cells[1]).text().trim();
      const agency = cells.length > 2 ? $(cells[2]).text().trim() : null;
      const dueDate = cells.length > 3 ? $(cells[3]).text().trim() : null;
      const postedDate = cells.length > 4 ? $(cells[4]).text().trim() : null;

      // Get link if available
      const link = $(cells[0]).find('a').attr('href') || $(cells[1]).find('a').attr('href');
      const url = link ? new URL(link, PA_EMARKETPLACE_URL).href : null;

      if (bidId || title) {
        const rawOpp = {
          bidId: bidId || `PA-${Date.now()}-${index}`,
          title,
          agency,
          dueDate: parseDate(dueDate),
          postedDate: parseDate(postedDate),
          url,
        };

        opportunities.push(normalizeOpportunity(rawOpp, sourceId));
      }
    } catch (err) {
      logger.warn('Error parsing PA row', { index, error: err.message });
    }
  });

  return opportunities;
}

/
 * Fetch opportunities from PA eMarketplace
 * @param {Object} profile - The opportunity_profile with filters
 * @param {Object} source - The procurement_source record
 * @param {Object} subscription - The source_subscription with config
 * @returns {Promise<Object[]>} - Array of normalized opportunities
 */
async function fetchOpportunities(profile, source, subscription) {
  try {
    logger.info('Fetching PA eMarketplace opportunities', {
      profileId: profile.id,
    });

    // Fetch the bid search page
    const response = await axios.get(PA_EMARKETPLACE_URL, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });

    // Parse HTML and extract opportunities
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

    logger.info('PA eMarketplace fetch complete', {
      total: opportunities.length,
      profileId: profile.id,
    });

    return opportunities;

  } catch (error) {
    logger.error('PA eMarketplace scrape error', {
      error: error.message,
      profileId: profile.id,
    });
    throw error;
  }
}

module.exports = fetchOpportunities;