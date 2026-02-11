/
 * NJ START Adapter
 * Scrapes New Jersey state procurement opportunities
 * NOTE: NJ START may require browser automation for full functionality
 */

const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../utils/logger');

const NJ_START_BASE_URL = 'https://www.njstart.gov/bso/';
const NJ_START_SEARCH_URL = 'https://www.njstart.gov/bso/external/publicBids.sdo';

/
 * Normalize NJ START opportunity to our schema
 * @param {Object} rawOpp - Scraped opportunity data
 * @param {string} sourceId - The procurement_sources.id
 * @returns {Object} - Normalized opportunity
 */
function normalizeOpportunity(rawOpp, sourceId) {
  return {
    source_id: sourceId,
    external_id: rawOpp.bidId,
    title: rawOpp.title || 'Untitled NJ Opportunity',
    description: rawOpp.description || null,
    buyer: rawOpp.agency || 'State of New Jersey',
    naics: rawOpp.naics || null,
    set_aside: rawOpp.setAside || null,
    value_min: null,
    value_max: null,
    posted_at: rawOpp.postedDate ? new Date(rawOpp.postedDate) : new Date(),
    response_due_at: rawOpp.dueDate ? new Date(rawOpp.dueDate) : null,
    url: rawOpp.url || NJ_START_BASE_URL,
    level: 'state_local',
    state: 'NJ',
    raw_data: rawOpp,
  };
}

/
 * Parse date from NJ format
 */
function parseDate(dateStr) {
  if (!dateStr) return null;
  const cleaned = dateStr.trim();
  const parsed = new Date(cleaned);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/
 * Attempt to scrape NJ START via HTTP
 * NOTE: This may fail due to JavaScript requirements - see browser fallback
 */
async function scrapeViaHttp(sourceId, profile) {
  const opportunities = [];

  try {
    const response = await axios.get(NJ_START_SEARCH_URL, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/json',
      },
    });

    const $ = cheerio.load(response.data);

    // NJ START bid table parsing
    $('table.bid-table tr, table[id*="bid"] tr, .bidList tr').each((index, row) => {
      if (index === 0) return; // Skip header

      const cells = $(row).find('td');
      if (cells.length < 3) return;

      try {
        const bidId = $(cells[0]).text().trim();
        const title = $(cells[1]).text().trim();
        const agency = cells.length > 2 ? $(cells[2]).text().trim() : null;
        const dueDate = cells.length > 3 ? $(cells[3]).text().trim() : null;

        const link = $(cells[0]).find('a').attr('href') || $(cells[1]).find('a').attr('href');
        const url = link ? new URL(link, NJ_START_BASE_URL).href : null;

        if (bidId || title) {
          opportunities.push(normalizeOpportunity({
            bidId: bidId || `NJ-${Date.now()}-${index}`,
            title,
            agency,
            dueDate: parseDate(dueDate),
            url,
          }, sourceId));
        }
      } catch (err) {
        logger.warn('Error parsing NJ row', { index, error: err.message });
      }
    });

  } catch (error) {
    logger.warn('NJ START HTTP scrape failed, may need browser automation', {
      error: error.message,
    });
  }

  return opportunities;
}

/
 * Fetch opportunities from NJ START
 * @param {Object} profile - The opportunity_profile with filters
 * @param {Object} source - The procurement_source record
 * @param {Object} subscription - The source_subscription with config
 * @returns {Promise<Object[]>} - Array of normalized opportunities
 */
async function fetchOpportunities(profile, source, subscription) {
  logger.info('Fetching NJ START opportunities', {
    profileId: profile.id,
  });

  let opportunities = [];

  // Try HTTP scraping first
  opportunities = await scrapeViaHttp(source.id, profile);

  // If HTTP fails or returns empty, log that browser automation may be needed
  if (opportunities.length === 0) {
    logger.warn('NJ START returned no results via HTTP - browser automation may be required', {
      profileId: profile.id,
      note: 'Consider implementing Puppeteer/Playwright for full NJ START access',
    });
    
    // TODO: Implement browser automation fallback
    // const puppeteer = require('puppeteer');
    // const browser = await puppeteer.launch({ headless: true });
    // const page = await browser.newPage();
    // await page.goto(NJ_START_BASE_URL);
    // ... interact with the page ...
  }

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

  logger.info('NJ START fetch complete', {
    total: opportunities.length,
    profileId: profile.id,
  });

  return opportunities;
}

module.exports = fetchOpportunities;