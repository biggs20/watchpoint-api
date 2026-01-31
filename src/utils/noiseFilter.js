/**
 * Noise Filter Utility
 * Filters out insignificant changes that don't represent meaningful content updates
 */

/**
 * Common noise patterns - changes matching these are considered insignificant
 */
const NOISE_PATTERNS = [
  // Copyright year changes (© 2023 → © 2024, © 2023-2024 → © 2023-2025)
  /(?:copyright|©|\(c\))\s*\d{4}(?:\s*-\s*\d{4})?/gi,
  
  // "Last updated" date-only changes
  /(?:last\s+(?:updated|modified)|updated\s+on|modified\s+on)\s*[:\s]*\d{1,2}[\/\-\.\s]\d{1,2}[\/\-\.\s]\d{2,4}/gi,
  
  // Timestamps (various formats)
  /\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/g,
  
  // "Today's date" patterns
  /(?:today|now|current\s+date)[:\s]*\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/gi,
  
  // Cookie consent banner common phrases
  /(?:we\s+use\s+cookies|cookie\s+(?:policy|notice|consent)|accept\s+(?:all\s+)?cookies|manage\s+cookies)/gi,
  
  // Ad/promo rotation phrases
  /(?:sponsored|advertisement|promoted|ad\s*:|promo(?:tion)?\s*:)/gi,
  
  // View/like/share counters (digits near these words)
  /(?:views?|likes?|shares?|comments?|followers?|subscribers?)[:\s]*[\d,\.]+[KMBkmb]?/gi,
  
  // Pure numeric changes (when a chunk is mostly numbers)
  // Will be handled in isNumericOnlyChange
];

/**
 * Check if a text chunk is mostly numeric
 * @param {string} text
 * @returns {boolean}
 */
const isNumericOnlyChange = (text) => {
  if (!text) return true;
  // Remove all digits, spaces, and common separators
  const nonNumeric = text.replace(/[\d\s,\.%$€£¥]+/g, '');
  // If more than 80% was numeric, consider it noise
  return nonNumeric.length < text.length * 0.2;
};

/**
 * Strip noise patterns from text for comparison
 * @param {string} text
 * @returns {string}
 */
const stripNoise = (text) => {
  if (!text) return '';
  let cleaned = text;
  for (const pattern of NOISE_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }
  return cleaned.trim();
};

/**
 * Check if a single chunk change is noise
 * @param {string} oldChunk
 * @param {string} newChunk
 * @returns {boolean}
 */
const isChunkNoise = (oldChunk, newChunk) => {
  // If both are empty after stripping, it's noise
  const oldStripped = stripNoise(oldChunk);
  const newStripped = stripNoise(newChunk);
  
  // If stripping noise makes them identical, it's noise
  if (oldStripped === newStripped) return true;
  
  // If the change is numeric-only, it's noise
  if (isNumericOnlyChange(oldChunk) && isNumericOnlyChange(newChunk)) return true;
  
  return false;
};

/**
 * Determine if a diff result represents only noise changes
 * @param {Object} diffResult - { added[], removed[], modified[], totalChanges }
 * @returns {boolean}
 */
const isNoise = (diffResult) => {
  if (!diffResult || diffResult.totalChanges === 0) return true;
  
  // Check added chunks
  for (const chunk of diffResult.added || []) {
    const stripped = stripNoise(chunk);
    if (stripped.length > 0 && !isNumericOnlyChange(stripped)) {
      return false; // Found meaningful addition
    }
  }
  
  // Check removed chunks
  for (const chunk of diffResult.removed || []) {
    const stripped = stripNoise(chunk);
    if (stripped.length > 0 && !isNumericOnlyChange(stripped)) {
      return false; // Found meaningful removal
    }
  }
  
  // Check modified chunks
  for (const mod of diffResult.modified || []) {
    if (!isChunkNoise(mod.old, mod.new)) {
      return false; // Found meaningful modification
    }
  }
  
  // All changes are noise
  return true;
};

module.exports = {
  isNoise,
  stripNoise,
  isChunkNoise,
  isNumericOnlyChange,
  NOISE_PATTERNS,
};
