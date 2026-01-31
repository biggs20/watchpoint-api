/**
 * Notification Service
 * Handles sending notifications via email with styled templates
 */

const { getClient, isConfigured, getFromEmail } = require('../config/sendgrid');

/**
 * Extract hostname from URL
 * @param {string} url
 * @returns {string}
 */
const getHostname = (url) => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

/**
 * Truncate text to max length with ellipsis
 * @param {string} text
 * @param {number} maxLength
 * @returns {string}
 */
const truncate = (text, maxLength = 140) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
};

/**
 * Extract diff snippets from diff_data
 * @param {Object|string} diffData
 * @returns {{ added: string[], removed: string[] }}
 */
const extractDiffSnippets = (diffData) => {
  const result = { added: [], removed: [] };
  
  if (!diffData) return result;
  
  try {
    const diff = typeof diffData === 'string' ? JSON.parse(diffData) : diffData;
    
    // Handle various diff formats
    if (diff.added && Array.isArray(diff.added)) {
      result.added = diff.added.slice(0, 2).map(s => truncate(s, 140));
    }
    if (diff.removed && Array.isArray(diff.removed)) {
      result.removed = diff.removed.slice(0, 2).map(s => truncate(s, 140));
    }
    
    // Handle diff lines format
    if (diff.lines && Array.isArray(diff.lines)) {
      const addedLines = diff.lines.filter(l => l.startsWith('+')).slice(0, 2);
      const removedLines = diff.lines.filter(l => l.startsWith('-')).slice(0, 2);
      result.added = addedLines.map(s => truncate(s.substring(1), 140));
      result.removed = removedLines.map(s => truncate(s.substring(1), 140));
    }
  } catch (e) {
    // If it's a string, try to extract something useful
    if (typeof diffData === 'string' && diffData.length > 0) {
      result.added = [truncate(diffData, 140)];
    }
  }
  
  return result;
};

/**
 * Build HTML email template for change notification
 * @param {Object} params
 * @returns {string}
 */
const buildChangeEmailHtml = ({ user, watch, change }) => {
  const hostname = getHostname(watch.target_url);
  const watchName = watch.name || hostname;
  const changeSummary = change.change_summary || 'Content has changed';
  const changeType = change.change_type || 'content';
  const detectedAt = new Date(change.detected_at).toLocaleString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });
  
  const diffSnippets = extractDiffSnippets(change.diff_data);
  
  // Build "What changed" section
  let whatChangedHtml = '';
  if (diffSnippets.added.length > 0 || diffSnippets.removed.length > 0) {
    whatChangedHtml = `
      <div style="margin-top: 24px; padding: 16px; background-color: #f8f9fa; border-radius: 8px;">
        <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #495057;">What changed:</h3>
        ${diffSnippets.removed.map(r => `
          <div style="padding: 8px 12px; margin-bottom: 8px; background-color: #ffebee; border-left: 3px solid #ef5350; border-radius: 4px; font-family: monospace; font-size: 13px; color: #c62828; word-break: break-word;">
            - ${r}
          </div>
        `).join('')}
        ${diffSnippets.added.map(a => `
          <div style="padding: 8px 12px; margin-bottom: 8px; background-color: #e8f5e9; border-left: 3px solid #66bb6a; border-radius: 4px; font-family: monospace; font-size: 13px; color: #2e7d32; word-break: break-word;">
            + ${a}
          </div>
        `).join('')}
      </div>
    `;
  }
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 40px 24px 40px; border-bottom: 1px solid #e9ecef;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-size: 24px; font-weight: 700; color: #1a1a2e; letter-spacing: -0.5px;">WatchPoint</span>
                  </td>
                  <td align="right">
                    <span style="display: inline-block; padding: 4px 12px; background-color: #fff3e0; color: #e65100; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase;">Alert</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 40px;">
              <!-- Summary -->
              <h1 style="margin: 0 0 24px 0; font-size: 28px; font-weight: 700; color: #1a1a2e; line-height: 1.3;">
                ${changeSummary}
              </h1>
              
              <!-- Details Grid -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e9ecef;">
                    <span style="color: #6c757d; font-size: 13px;">Watch</span><br>
                    <span style="color: #1a1a2e; font-size: 15px; font-weight: 500;">${watchName}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e9ecef;">
                    <span style="color: #6c757d; font-size: 13px;">URL</span><br>
                    <a href="${watch.target_url}" style="color: #0066cc; font-size: 15px; text-decoration: none; word-break: break-all;">${hostname}</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e9ecef;">
                    <span style="color: #6c757d; font-size: 13px;">Detected</span><br>
                    <span style="color: #1a1a2e; font-size: 15px;">${detectedAt}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0;">
                    <span style="color: #6c757d; font-size: 13px;">Change Type</span><br>
                    <span style="display: inline-block; padding: 2px 8px; background-color: #e3f2fd; color: #1565c0; border-radius: 4px; font-size: 13px; font-weight: 500; text-transform: capitalize;">${changeType}</span>
                  </td>
                </tr>
              </table>
              
              <!-- View Button -->
              <a href="${watch.target_url}" style="display: inline-block; padding: 14px 28px; background-color: #1a1a2e; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
                View Page &rarr;
              </a>
              
              ${whatChangedHtml}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f8f9fa; border-radius: 0 0 12px 12px;">
              <p style="margin: 0; font-size: 13px; color: #6c757d; line-height: 1.5;">
                You're receiving this because you set up a watch in WatchPoint.<br>
                <a href="#" style="color: #6c757d;">Manage notification settings</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

/**
 * Send change email notification
 * @param {Object} params - { user, watch, change }
 * @throws {Error} - 'sendgrid_not_configured' if SendGrid is not available
 * @returns {Object} - { success: true }
 */
const sendChangeEmail = async ({ user, watch, change }) => {
  // Check if SendGrid is configured
  if (!isConfigured()) {
    throw new Error('sendgrid_not_configured');
  }
  
  const client = getClient();
  if (!client) {
    throw new Error('sendgrid_not_configured');
  }
  
  const hostname = getHostname(watch.target_url);
  const watchName = watch.name || hostname;
  const changeSummary = change.change_summary || 'Content has changed';
  
  const subject = `WatchPoint Alert: ${watchName} — ${changeSummary}`;
  const html = buildChangeEmailHtml({ user, watch, change });
  
  const msg = {
    to: user.email,
    from: {
      email: getFromEmail(),
      name: 'WatchPoint Alerts'
    },
    subject,
    html,
    text: `WatchPoint Alert: ${watchName}\n\n${changeSummary}\n\nURL: ${watch.target_url}\nDetected: ${change.detected_at}\nChange Type: ${change.change_type || 'content'}`,
  };
  
  await client.send(msg);
  console.log(`Email sent to ${user.email} for watch ${watch.id}`);
  
  return { success: true };
};

module.exports = {
  sendChangeEmail,
  buildChangeEmailHtml,
  extractDiffSnippets,
  getHostname,
  truncate,
};
