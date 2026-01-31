/**
 * Diff Engine Utility
 * Computes intelligent diffs between text content
 */

/**
 * Split text into chunks by blank lines/double newlines
 * @param {string} text
 * @returns {string[]}
 */
const splitIntoChunks = (text) => {
  if (!text) return [];
  // Split by double newlines or blank lines
  return text
    .split(/\n\s*\n|\r\n\s*\r\n/)
    .map(chunk => chunk.trim())
    .filter(chunk => chunk.length > 0);
};

/**
 * Calculate word-based similarity between two strings
 * @param {string} text1
 * @param {string} text2
 * @returns {number} - 0 to 1
 */
const similarity = (text1, text2) => {
  if (!text1 && !text2) return 1;
  if (!text1 || !text2) return 0;
  
  const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 0));
  const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 0));
  
  const allWords = new Set([...words1, ...words2]);
  if (allWords.size === 0) return 1;
  
  let sharedCount = 0;
  for (const word of words1) {
    if (words2.has(word)) sharedCount++;
  }
  
  return sharedCount / allWords.size;
};

/**
 * Optional helper to remove obvious noise lines before diff
 * @param {string} text
 * @returns {string}
 */
const stripNoiseLines = (text) => {
  if (!text) return '';
  
  const noisePatterns = [
    /^\s*<\!--.*-->\s*$/i,           // HTML comments
    /^\s*\/\/.*$/,                    // JS comments
    /^\s*#.*$/,                         // Hash comments
    /^\s*$/,                            // Empty lines
  ];
  
  return text
    .split('\n')
    .filter(line => !noisePatterns.some(p => p.test(line)))
    .join('\n');
};

/**
 * Compute diff between old and new text
 * @param {string} oldText
 * @param {string} newText
 * @returns {Object} - { added[], removed[], modified[], totalChanges }
 */
const computeDiff = (oldText, newText) => {
  const oldChunks = splitIntoChunks(oldText);
  const newChunks = splitIntoChunks(newText);
  
  const added = [];
  const removed = [];
  const modified = [];
  
  // Track which chunks have been matched
  const matchedOld = new Set();
  const matchedNew = new Set();
  
  // First pass: find exact matches
  for (let i = 0; i < newChunks.length; i++) {
    const idx = oldChunks.findIndex((c, j) => !matchedOld.has(j) && c === newChunks[i]);
    if (idx !== -1) {
      matchedOld.add(idx);
      matchedNew.add(i);
    }
  }
  
  // Second pass: find similar chunks (modified)
  for (let i = 0; i < newChunks.length; i++) {
    if (matchedNew.has(i)) continue;
    
    let bestMatch = -1;
    let bestSim = 0.6; // Threshold
    
    for (let j = 0; j < oldChunks.length; j++) {
      if (matchedOld.has(j)) continue;
      
      const sim = similarity(oldChunks[j], newChunks[i]);
      if (sim >= bestSim && sim < 1) {
        bestSim = sim;
        bestMatch = j;
      }
    }
    
    if (bestMatch !== -1) {
      modified.push({
        old: oldChunks[bestMatch],
        new: newChunks[i],
        similarity: bestSim
      });
      matchedOld.add(bestMatch);
      matchedNew.add(i);
    }
  }
  
  // Collect unmatched as added/removed
  for (let i = 0; i < newChunks.length; i++) {
    if (!matchedNew.has(i)) {
      added.push(newChunks[i]);
    }
  }
  
  for (let j = 0; j < oldChunks.length; j++) {
    if (!matchedOld.has(j)) {
      removed.push(oldChunks[j]);
    }
  }
  
  return {
    added,
    removed,
    modified,
    totalChanges: added.length + removed.length + modified.length
  };
};

module.exports = {
  computeDiff,
  similarity,
  splitIntoChunks,
  stripNoiseLines,
};
