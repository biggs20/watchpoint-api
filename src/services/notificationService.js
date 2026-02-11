/
 * Notification Service
 * Handles sending notifications via email with styled templates
 * Enhanced for GovBid Scout with opportunity-focused emails
 */

const { getClient, isConfigured, getFromEmail } = require('../config/sendgrid');
const {
  generateDailyDigest,
  generateUrgentAlert,
  generateWeeklyBrief
} = require('./emailTemplates');

const getHostname = (url) => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

const truncate = (text, maxLength = 140) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
};

const extractDiffSnippets = (diffData) => {
  const result = { added: [], removed: [] };
  if (!diffData) return result;
  
  try {
    const diff = typeof diffData === 'string' ? JSON.parse(diffData) : diffData;
    if (diff.added && Array.isArray(diff.added)) {
      result.added = diff.added.slice(0, 2).map(s => truncate(s, 140));
    }
    if (diff.removed && Array.isArray(diff.removed)) {
      result.removed = diff.removed.slice(0, 2).map(s => truncate(s, 140));
    }
    if (diff.lines && Array.isArray(diff.lines)) {
      result.added = diff.lines.filter(l => l.startsWith('+')).slice(0, 2).map(s => truncate(s.substring(1), 140));
      result.removed = diff.lines.filter(l => l.startsWith('-')).slice(0, 2).map(s => truncate(s.substring(1), 140));
    }
  } catch (e) {
    if (typeof diffData === 'string' && diffData.length > 0) {
      result.added = [truncate(diffData, 140)];
    }
  }
  return result;
};

// Keep existing buildChangeEmailHtml for backward compatibility
const buildChangeEmailHtml = (change, watch, profile) => {
  const siteName = getHostname(watch.url);
  const diffSnippets = extractDiffSnippets(change.diff_data);
  const summary = change.summary || 'Content has changed on this page.';
  const severity = change.severity || 'medium';
  const severityColors = { low: '#28a745', medium: '#fd7e14', high: '#dc3545' };
  const severityColor = severityColors[severity] || severityColors.medium;
  
  return '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">' +
    '<div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">' +
    '<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 25px; text-align: center;">' +
    '<h1 style="margin: 0; font-size: 24px;">Change Detected</h1>' +
    '<p style="margin: 10px 0 0; font-size: 14px; opacity: 0.9;">' + siteName + '</p></div>' +
    '<div style="padding: 25px;">' +
    '<div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 20px;">' +
    '<h2 style="margin: 0 0 10px; font-size: 16px;">' + (watch.name || 'Watched Page') + '</h2>' +
    '<p style="margin: 0;"><a href="' + watch.url + '" style="color: #667eea;">' + truncate(watch.url, 60) + '</a></p></div>' +
    '<div style="margin-bottom: 20px;">' +
    '<span style="display: inline-block; background-color: ' + severityColor + '; color: white; padding: 4px 12px; border-radius: 4px; font-size: 12px; text-transform: uppercase;">' + severity + ' priority</span></div>' +
    '<div style="margin-bottom: 20px;"><h3 style="margin: 0 0 10px; font-size: 14px;">Summary</h3>' +
    '<p style="margin: 0; color: #4a5568; line-height: 1.6;">' + summary + '</p></div>' +
    '<div style="text-align: center; margin-top: 25px;">' +
    '<a href="' + watch.url + '" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 600;">View Page</a></div></div>' +
    '<div style="background-color: #f8f9fa; padding: 20px 25px; text-align: center; border-top: 1px solid #e2e8f0;">' +
    '<p style="margin: 0; color: #718096; font-size: 12px;">Detected at ' + new Date(change.detected_at).toLocaleString() + '</p></div></div></body></html>';
};

const sendChangeEmail = async (change, watch, profile) => {
  if (!isConfigured()) {
    console.warn('SendGrid not configured - skipping email notification');
    return { success: false, error: 'SendGrid not configured' };
  }
  const client = getClient();
  const siteName = getHostname(watch.url);
  
  const msg = {
    to: profile.email,
    from: { email: getFromEmail(), name: 'WatchPoint Alerts' },
    subject: 'Change detected: ' + (watch.name || siteName),
    html: buildChangeEmailHtml(change, watch, profile),
    text: 'Change detected on ' + (watch.name || siteName) + '\n\nURL: ' + watch.url + '\n\nSummary: ' + (change.summary || 'Content has changed.')
  };

  try {
    await client.send(msg);
    console.log('Email sent to ' + profile.email + ' for change ' + change.id);
    return { success: true };
  } catch (error) {
    console.error('SendGrid error:', error.response?.body || error.message);
    return { success: false, error: error.message };
  }
};

const sendDailyDigest = async (user, opportunities) => {
  if (!isConfigured()) {
    console.warn('SendGrid not configured - skipping daily digest');
    return { success: false, error: 'SendGrid not configured' };
  }
  if (!opportunities || opportunities.length === 0) {
    console.log('No opportunities to send in digest for ' + user.email);
    return { success: true, skipped: true, reason: 'No opportunities' };
  }

  const client = getClient();
  const dashboardUrl = process.env.DASHBOARD_URL || 'https://app.govbidscout.com';
  const { subject, html, text } = generateDailyDigest({ user, opportunities, dashboardUrl });

  const msg = {
    to: user.email,
    from: { email: getFromEmail(), name: 'GovBid Scout' },
    subject, html, text
  };

  try {
    await client.send(msg);
    console.log('Daily digest sent to ' + user.email + ' with ' + opportunities.length + ' opportunities');
    return { success: true, count: opportunities.length };
  } catch (error) {
    console.error('SendGrid error (daily digest):', error.response?.body || error.message);
    return { success: false, error: error.message };
  }
};

const sendUrgentAlert = async (user, opportunity) => {
  if (!isConfigured()) {
    console.warn('SendGrid not configured - skipping urgent alert');
    return { success: false, error: 'SendGrid not configured' };
  }

  const client = getClient();
  const dashboardUrl = process.env.DASHBOARD_URL || 'https://app.govbidscout.com';
  const { subject, html, text } = generateUrgentAlert({ user, opportunity, dashboardUrl });

  const msg = {
    to: user.email,
    from: { email: getFromEmail(), name: 'GovBid Scout Alerts' },
    subject, html, text,
    headers: { 'X-Priority': '1', 'X-MSMail-Priority': 'High', 'Importance': 'High' }
  };

  try {
    await client.send(msg);
    console.log('Urgent alert sent to ' + user.email + ' for opportunity ' + opportunity.id);
    return { success: true };
  } catch (error) {
    console.error('SendGrid error (urgent alert):', error.response?.body || error.message);
    return { success: false, error: error.message };
  }
};

const sendWeeklyBrief = async (user, data) => {
  if (!isConfigured()) {
    console.warn('SendGrid not configured - skipping weekly brief');
    return { success: false, error: 'SendGrid not configured' };
  }

  const client = getClient();
  const dashboardUrl = process.env.DASHBOARD_URL || 'https://app.govbidscout.com';
  const { subject, html, text } = generateWeeklyBrief({
    user,
    stats: data.stats,
    upcomingDeadlines: data.upcomingDeadlines,
    missedOpportunities: data.missedOpportunities,
    activeAgencies: data.activeAgencies,
    dashboardUrl
  });

  const msg = {
    to: user.email,
    from: { email: getFromEmail(), name: 'GovBid Scout' },
    subject, html, text
  };

  try {
    await client.send(msg);
    console.log('Weekly brief sent to ' + user.email);
    return { success: true };
  } catch (error) {
    console.error('SendGrid error (weekly brief):', error.response?.body || error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendChangeEmail,
  sendDailyDigest,
  sendUrgentAlert,
  sendWeeklyBrief,
  buildChangeEmailHtml,
  extractDiffSnippets,
  truncate,
  getHostname
};