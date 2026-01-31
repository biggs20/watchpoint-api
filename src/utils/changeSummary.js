/**
 * Change Summary Utility
 * Generates human-readable summaries of content changes
 */

/**
 * Truncate text to a maximum length with ellipsis
 * @param {string} text
 * @param {number} maxLength
 * @returns {string}
 */
const truncate = (text, maxLength = 50) => {
  if (!text) return '';
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.substring(0, maxLength - 3).trim() + '...';
};

/**
 * Get a representative snippet from changes
 * @param {Object} diffResult
 * @returns {string}
 */
const getSnippet = (diffResult) => {
  // Priority: modified > added > removed
  if (diffResult.modified && diffResult.modified.length > 0) {
    return truncate(diffResult.modified[0].new);
  }
  if (diffResult.added && diffResult.added.length > 0) {
    return truncate(diffResult.added[0]);
  }
  if (diffResult.removed && diffResult.removed.length > 0) {
    return truncate(diffResult.removed[0]);
  }
  return '';
};

/**
 * Generate a human-readable summary of changes
 * Always <= 180 characters
 * @param {Object} diffResult - { added[], removed[], modified[], totalChanges }
 * @returns {string}
 */
const summarizeChange = (diffResult) => {
  if (!diffResult || diffResult.totalChanges === 0) {
    return 'No significant changes detected';
  }
  
  const addedCount = (diffResult.added || []).length;
  const removedCount = (diffResult.removed || []).length;
  const modifiedCount = (diffResult.modified || []).length;
  const total = addedCount + removedCount + modifiedCount;
  
  // Small changes: descriptive with snippet
  if (total === 1) {
    const snippet = getSnippet(diffResult);
    if (addedCount === 1) {
      return snippet ? `New content added: "${truncate(snippet, 100)}"` : 'New content added';
    }
    if (removedCount === 1) {
      return snippet ? `Content removed: "${truncate(snippet, 100)}"` : 'Content removed';
    }
    if (modifiedCount === 1) {
      return snippet ? `Content updated: "${truncate(snippet, 100)}"` : 'Content updated';
    }
  }
  
  // Medium changes (2-3 sections)
  if (total <= 3) {
    const parts = [];
    if (addedCount > 0) parts.push(`${addedCount} added`);
    if (removedCount > 0) parts.push(`${removedCount} removed`);
    if (modifiedCount > 0) parts.push(`${modifiedCount} modified`);
    
    const snippet = getSnippet(diffResult);
    const base = `${total} sections changed (${parts.join(', ')})`;
    
    if (snippet && base.length + snippet.length + 5 < 180) {
      return `${base}: "${truncate(snippet, 80)}"`;
    }
    return base;
  }
  
  // Larger changes: summary only
  const parts = [];
  if (addedCount > 0) parts.push(`${addedCount} added`);
  if (removedCount > 0) parts.push(`${removedCount} removed`);
  if (modifiedCount > 0) parts.push(`${modifiedCount} modified`);
  
  return `${total} sections changed (${parts.join(', ')})`;
};

module.exports = {
  summarizeChange,
  truncate,
  getSnippet,
};
