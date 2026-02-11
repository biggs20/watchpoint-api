/
 * Adapter Registry
 * Maps procurement source names to their adapter functions
 */

const samGovAdapter = require('./samGov');
const paEmarketplaceAdapter = require('./paEmarketplace');
const njStartAdapter = require('./njStart');
const deMarketlinkAdapter = require('./deMarketlink');
const watchpointScrapeAdapter = require('./watchpointScrape');

const adapters = {
  sam_gov: samGovAdapter,
  pa_emarketplace: paEmarketplaceAdapter,
  nj_start: njStartAdapter,
  de_marketlink: deMarketlinkAdapter,
  watchpoint_scrape: watchpointScrapeAdapter,
};

/
 * Get adapter function for a given source name
 * @param {string} sourceName - The procurement source name
 * @returns {Function|null} - The adapter function or null if not found
 */
function getAdapter(sourceName) {
  return adapters[sourceName] || null;
}

/
 * List all available adapter names
 * @returns {string[]} - Array of adapter names
 */
function listAdapters() {
  return Object.keys(adapters);
}

/
 * Check if an adapter exists for a source
 * @param {string} sourceName - The procurement source name
 * @returns {boolean}
 */
function hasAdapter(sourceName) {
  return sourceName in adapters;
}

module.exports = {
  getAdapter,
  listAdapters,
  hasAdapter,
  adapters,
};