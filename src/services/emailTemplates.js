/
 * Email Templates Service
 * Action-oriented, hyper-aggressive email templates for government contracting
 * Includes contact boxes, pre-written outreach, and urgency indicators
 */

/
 * Format currency value
 * @param {number} value
 * @returns {string}
 */
const formatCurrency = (value) => {
  if (!value) return 'TBD';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(value);
};

/
 * Format value range
 * @param {number} low
 * @param {number} high
 * @returns {string}
 */
const formatValueRange = (low, high) => {
  if (!low && !high) return 'Not Specified';
  if (low && high) return `${formatCurrency(low)} - ${formatCurrency(high)}`;
  if (high) return `Up to ${formatCurrency(high)}`;
  return `${formatCurrency(low)}+`;
};

/
 * Calculate days until deadline
 * @param {Date|string} dueDate
 * @returns {number}
 */
const daysUntil = (dueDate) => {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  const now = new Date();
  const diffTime = due - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/
 * Get urgency indicator
 * @param {number} days
 * @returns {Object}
 */
const getUrgencyIndicator = (days) => {
  if (days === null) return { emoji: '', text: '', color: '#666666' };
  if (days <= 0) return { emoji: '🔴', text: 'EXPIRED', color: '#dc3545' };
  if (days <= 3) return { emoji: '🚨', text: `${days} DAYS LEFT`, color: '#dc3545' };
  if (days <= 7) return { emoji: '⚠️', text: `${days} days left`, color: '#fd7e14' };
  if (days <= 14) return { emoji: '⏰', text: `${days} days left`, color: '#ffc107' };
  return { emoji: '📅', text: `${days} days left`, color: '#28a745' };
};

/
 * Format fit score badge
 * @param {number} score
 * @returns {Object}
 */
const getFitScoreBadge = (score) => {
  if (score >= 90) return { color: '#28a745', label: 'EXCELLENT FIT' };
  if (score >= 80) return { color: '#20c997', label: 'STRONG FIT' };
  if (score >= 70) return { color: '#17a2b8', label: 'GOOD FIT' };
  if (score >= 60) return { color: '#ffc107', label: 'MODERATE FIT' };
  return { color: '#6c757d', label: 'LOW FIT' };
};

/
 * Generate mailto link with pre-written inquiry
 * @param {Object} opp - Opportunity
 * @param {Object} user - User profile
 * @returns {string}
 */
const generateMailtoLink = (opp, user) => {
  const email = opp.contracting_officer_email || opp.contact_email;
  if (!email) return null;
  
  const subject = encodeURIComponent(`Inquiry: ${opp.solicitation_number || opp.title}`);
  const body = encodeURIComponent(
`Dear ${opp.contracting_officer_name || opp.contact_name || 'Contracting Officer'},

I am writing regarding ${opp.solicitation_number || 'the opportunity'}: "${opp.title}".

${user?.company_name ? `${user.company_name} is` : 'Our company is'} interested in this opportunity and would like to request:

1. Any additional information about the requirements
2. Clarification on the evaluation criteria
3. Opportunity for a pre-bid meeting or site visit (if applicable)

We have relevant experience in ${opp.naics_description || 'this area'} and would welcome the chance to discuss how we can support this requirement.

Best regards,
${user?.name || '[Your Name]'}
${user?.company_name || '[Company Name]'}
${user?.email || '[Email]'}
${user?.phone || '[Phone]'}`
  );
  
  return `mailto:${email}?subject=${subject}&body=${body}`;
};

/
 * Inline CSS styles for Gmail compatibility
 */
const styles = {
  container: 'max-width: 700px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; background-color: #ffffff;',
  header: 'background: linear-gradient(135deg, #1a365d 0%, #2c5282 100%); color: white; padding: 30px 25px; text-align: center;',
  headerTitle: 'margin: 0; font-size: 24px; font-weight: 700;',
  headerSubtitle: 'margin: 10px 0 0; font-size: 14px; opacity: 0.9;',
  section: 'padding: 20px 25px;',
  card: 'background: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 20px; border-left: 4px solid #2c5282;',
  urgentCard: 'background: #fff5f5; border-radius: 8px; padding: 20px; margin-bottom: 20px; border-left: 4px solid #dc3545;',
  title: 'margin: 0 0 8px; font-size: 18px; color: #1a202c; font-weight: 600;',
  badge: 'display: inline-block; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-left: 8px;',
  meta: 'color: #4a5568; font-size: 14px; margin: 4px 0;',
  contactBox: 'background: #e6f3ff; border: 2px solid #2c5282; border-radius: 8px; padding: 15px; margin: 15px 0;',
  contactBoxUrgent: 'background: #ffe6e6; border: 2px solid #dc3545; border-radius: 8px; padding: 15px; margin: 15px 0;',
  contactTitle: 'font-weight: 700; color: #1a365d; margin-bottom: 10px; font-size: 14px;',
  contactItem: 'margin: 5px 0; font-size: 14px;',
  link: 'color: #2c5282; text-decoration: none; font-weight: 600;',
  button: 'display: inline-block; padding: 12px 24px; background-color: #2c5282; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; margin-right: 10px; margin-top: 10px;',
  buttonSecondary: 'display: inline-block; padding: 12px 24px; background-color: #e2e8f0; color: #2c5282; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; margin-right: 10px; margin-top: 10px;',
  buttonUrgent: 'display: inline-block; padding: 12px 24px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; margin-right: 10px; margin-top: 10px;',
  statsRow: 'display: flex; justify-content: space-between; padding: 15px 0; border-bottom: 1px solid #e2e8f0;',
  statItem: 'text-align: center; flex: 1;',
  statNumber: 'font-size: 28px; font-weight: 700; color: #2c5282;',
  statLabel: 'font-size: 12px; color: #718096; text-transform: uppercase;',
  reasonBox: 'background: #f0fff4; border-radius: 4px; padding: 10px 15px; margin-top: 10px; font-size: 13px; color: #276749;',
  footer: 'background: #f8f9fa; padding: 25px; text-align: center; border-top: 1px solid #e2e8f0;',
  footerText: 'color: #718096; font-size: 12px; margin: 0;'
};

/
 * Generate contact box HTML
 * @param {Object} opp - Opportunity
 * @param {Object} user - User profile (for mailto)
 * @param {boolean} urgent - Use urgent styling
 * @returns {string}
 */
const generateContactBox = (opp, user, urgent = false) => {
  const hasContact = opp.contact_name || opp.contact_email || opp.contact_phone;
  const hasCO = opp.contracting_officer_name || opp.contracting_officer_email || opp.contracting_officer_phone;
  
  if (!hasContact && !hasCO) return '';
  
  const boxStyle = urgent ? styles.contactBoxUrgent : styles.contactBox;
  const mailtoLink = generateMailtoLink(opp, user);
  
  let html = `<div style="${boxStyle}">`;
  html += `<div style="${styles.contactTitle}">📞 CONTACT NOW</div>`;
  
  if (hasCO) {
    html += `<div style="margin-bottom: 12px;">`;
    html += `<strong>Contracting Officer:</strong><br>`;
    if (opp.contracting_officer_name) html += `<div style="${styles.contactItem}">👤 ${opp.contracting_officer_name}</div>`;
    if (opp.contracting_officer_email) html += `<div style="${styles.contactItem}">✉️ <a href="mailto:${opp.contracting_officer_email}" style="${styles.link}">${opp.contracting_officer_email}</a></div>`;
    if (opp.contracting_officer_phone) html += `<div style="${styles.contactItem}">📱 <a href="tel:${opp.contracting_officer_phone}" style="${styles.link}">${opp.contracting_officer_phone}</a></div>`;
    html += `</div>`;
  }
  
  if (hasContact && (opp.contact_email !== opp.contracting_officer_email)) {
    html += `<div style="margin-bottom: 12px;">`;
    html += `<strong>Point of Contact:</strong><br>`;
    if (opp.contact_name) html += `<div style="${styles.contactItem}">👤 ${opp.contact_name}${opp.contact_title ? ` (${opp.contact_title})` : ''}</div>`;
    if (opp.contact_email) html += `<div style="${styles.contactItem}">✉️ <a href="mailto:${opp.contact_email}" style="${styles.link}">${opp.contact_email}</a></div>`;
    if (opp.contact_phone) html += `<div style="${styles.contactItem}">📱 <a href="tel:${opp.contact_phone}" style="${styles.link}">${opp.contact_phone}</a></div>`;
    html += `</div>`;
  }
  
  if (mailtoLink) {
    html += `<div style="margin-top: 15px;">`;
    html += `<a href="${mailtoLink}" style="${urgent ? styles.buttonUrgent : styles.button}">📧 Send Inquiry Email</a>`;
    html += `</div>`;
  }
  
  html += `</div>`;
  return html;
};

/
 * Generate opportunity card HTML
 * @param {Object} opp - Opportunity
 * @param {Object} user - User profile
 * @param {boolean} isHero - Is hero/featured card
 * @returns {string}
 */
const generateOpportunityCard = (opp, user, isHero = false) => {
  const days = daysUntil(opp.due_at);
  const urgency = getUrgencyIndicator(days);
  const fitBadge = getFitScoreBadge(opp.fit_score || 0);
  const isUrgent = days !== null && days <= 3;
  const cardStyle = isUrgent ? styles.urgentCard : styles.card;
  
  let html = `<div style="${cardStyle}">`;
  
  // Title with badges
  html += `<h3 style="${styles.title}">`;
  html += opp.title;
  if (opp.fit_score) {
    html += `<span style="${styles.badge} background-color: ${fitBadge.color}; color: white;">${opp.fit_score}% ${fitBadge.label}</span>`;
  }
  html += `</h3>`;
  
  // Quick stats row
  html += `<div style="margin: 10px 0;">`;
  html += `<span style="${styles.meta}"><strong>Agency:</strong> ${opp.buyer || opp.department || 'N/A'}</span><br>`;
  html += `<span style="${styles.meta}"><strong>Value:</strong> ${formatValueRange(opp.estimated_value_low, opp.estimated_value_high)}</span><br>`;
  if (opp.solicitation_number) {
    html += `<span style="${styles.meta}"><strong>Solicitation:</strong> ${opp.solicitation_number}</span><br>`;
  }
  html += `<span style="${styles.meta}"><strong>Due:</strong> ${opp.due_at ? new Date(opp.due_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'Not Specified'} <span style="color: ${urgency.color}; font-weight: 600;">${urgency.emoji} ${urgency.text}</span></span>`;
  html += `</div>`;
  
  // Quick details
  html += `<div style="margin: 10px 0; font-size: 13px; color: #4a5568;">`;
  if (opp.naics_code) html += `<span style="margin-right: 15px;">📊 NAICS: ${opp.naics_code}</span>`;
  if (opp.set_aside_type) html += `<span style="margin-right: 15px;">🏷️ ${opp.set_aside_description || opp.set_aside_type}</span>`;
  if (opp.contract_type) html += `<span>📝 ${opp.contract_type}</span>`;
  html += `</div>`;
  
  // Questions deadline warning
  if (opp.questions_due_at) {
    const qDays = daysUntil(opp.questions_due_at);
    if (qDays !== null && qDays <= 7) {
      html += `<div style="background: #fffaf0; border: 1px solid #f6ad55; border-radius: 4px; padding: 8px 12px; margin: 10px 0; font-size: 13px;">`;
      html += `⚡ <strong>Questions Due:</strong> ${new Date(opp.questions_due_at).toLocaleDateString()} (${qDays} days)`;
      html += `</div>`;
    }
  }
  
  // Contact box
  html += generateContactBox(opp, user, isUrgent);
  
  // Fit reasons (if available)
  if (opp.fit_reasons && opp.fit_reasons.length > 0) {
    html += `<div style="${styles.reasonBox}">`;
    html += `<strong>Why this matched:</strong> ${opp.fit_reasons.slice(0, 3).join(' • ')}`;
    html += `</div>`;
  }
  
  // Attachments count
  if (opp.attachments && opp.attachments.length > 0) {
    html += `<div style="margin-top: 10px; font-size: 13px;">`;
    html += `📎 <strong>${opp.attachments.length} document(s)</strong> available - `;
    html += `<a href="${opp.url}" style="${styles.link}">View on SAM.gov</a>`;
    html += `</div>`;
  }
  
  // Incumbent info (competitive intel)
  if (opp.incumbent_contractor) {
    html += `<div style="margin-top: 10px; background: #fef5e7; padding: 8px 12px; border-radius: 4px; font-size: 13px;">`;
    html += `🏆 <strong>Incumbent:</strong> ${opp.incumbent_contractor}`;
    html += `</div>`;
  }
  
  // Action buttons
  html += `<div style="margin-top: 15px;">`;
  html += `<a href="${opp.url}" style="${styles.button}">View Details</a>`;
  if (opp.contracting_officer_email || opp.contact_email) {
    const mailto = generateMailtoLink(opp, user);
    if (mailto) {
      html += `<a href="${mailto}" style="${styles.buttonSecondary}">Contact Officer</a>`;
    }
  }
  html += `</div>`;
  
  html += `</div>`;
  return html;
};

/
 * Generate Daily Digest Email
 * @param {Object} params
 * @param {Object} params.user - User profile
 * @param {Array} params.opportunities - Matched opportunities
 * @param {string} params.dashboardUrl - Dashboard URL
 * @returns {Object} { subject, html, text }
 */
const generateDailyDigest = ({ user, opportunities, dashboardUrl }) => {
  const date = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const count = opportunities.length;
  
  // Sort by fit score
  const sorted = [...opportunities].sort((a, b) => (b.fit_score || 0) - (a.fit_score || 0));
  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);
  
  // Stats
  const highFit = opportunities.filter(o => (o.fit_score || 0) >= 80).length;
  const closingThisWeek = opportunities.filter(o => {
    const days = daysUntil(o.due_at);
    return days !== null && days <= 7;
  }).length;
  
  const subject = `🎯 ${count} New Opportunities Match Your Profile — ${date}`;
  
  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="margin: 0; padding: 0; background-color: #f5f5f5;">`;
  html += `<div style="${styles.container}">`;
  
  // Header
  html += `<div style="${styles.header}">`;
  html += `<h1 style="${styles.headerTitle}">🎯 GovBid Scout Daily Digest</h1>`;
  html += `<p style="${styles.headerSubtitle}">${date}</p>`;
  html += `</div>`;
  
  // Stats summary
  html += `<div style="${styles.section}">`;
  html += `<table style="width: 100%; border-collapse: collapse;"><tr>`;
  html += `<td style="text-align: center; padding: 15px; border-right: 1px solid #e2e8f0;"><div style="${styles.statNumber}">${count}</div><div style="${styles.statLabel}">New Matches</div></td>`;
  html += `<td style="text-align: center; padding: 15px; border-right: 1px solid #e2e8f0;"><div style="${styles.statNumber}">${highFit}</div><div style="${styles.statLabel}">High Fit (80%+)</div></td>`;
  html += `<td style="text-align: center; padding: 15px;"><div style="${styles.statNumber} color: #dc3545;">${closingThisWeek}</div><div style="${styles.statLabel}">Closing This Week</div></td>`;
  html += `</tr></table>`;
  html += `</div>`;
  
  // Top 3 opportunities
  if (top3.length > 0) {
    html += `<div style="${styles.section}">`;
    html += `<h2 style="margin: 0 0 15px; font-size: 18px; color: #1a202c;">⭐ Top Opportunities</h2>`;
    top3.forEach(opp => {
      html += generateOpportunityCard(opp, user, true);
    });
    html += `</div>`;
  }
  
  // Remaining opportunities
  if (rest.length > 0) {
    html += `<div style="${styles.section}">`;
    html += `<h2 style="margin: 0 0 15px; font-size: 18px; color: #1a202c;">📋 More Opportunities</h2>`;
    rest.forEach(opp => {
      html += generateOpportunityCard(opp, user, false);
    });
    html += `</div>`;
  }
  
  // Footer
  html += `<div style="${styles.footer}">`;
  html += `<a href="${dashboardUrl}" style="${styles.button}">View All in Dashboard</a>`;
  html += `<p style="${styles.footerText}">You're receiving this because you subscribed to GovBid Scout alerts.<br>`;
  html += `<a href="${dashboardUrl}/settings" style="color: #718096;">Manage preferences</a></p>`;
  html += `</div>`;
  
  html += `</div></body></html>`;
  
  // Plain text version
  const text = `GovBid Scout Daily Digest - ${date}\n\n` +
    `${count} new opportunities match your profile.\n` +
    `${highFit} high-fit (80%+) | ${closingThisWeek} closing this week\n\n` +
    `TOP OPPORTUNITIES:\n` +
    top3.map(o => `- ${o.title}\n  Agency: ${o.buyer || 'N/A'}\n  Due: ${o.due_at || 'TBD'}\n  Contact: ${o.contact_email || o.contracting_officer_email || 'N/A'}\n`).join('\n') +
    `\n\nView all: ${dashboardUrl}`;
  
  return { subject, html, text };
};

/
 * Generate Urgent Alert Email
 * @param {Object} params
 * @param {Object} params.user - User profile
 * @param {Object} params.opportunity - High-priority opportunity
 * @param {string} params.dashboardUrl - Dashboard URL
 * @returns {Object} { subject, html, text }
 */
const generateUrgentAlert = ({ user, opportunity, dashboardUrl }) => {
  const opp = opportunity;
  const days = daysUntil(opp.due_at);
  const urgency = getUrgencyIndicator(days);
  const dueDate = opp.due_at ? new Date(opp.due_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'TBD';
  
  const subject = `🚨 HIGH-PRIORITY: ${opp.title.substring(0, 60)}${opp.title.length > 60 ? '...' : ''} — Due ${dueDate}`;
  
  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="margin: 0; padding: 0; background-color: #f5f5f5;">`;
  html += `<div style="${styles.container}">`;
  
  // Urgent header
  html += `<div style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; padding: 30px 25px; text-align: center;">`;
  html += `<h1 style="${styles.headerTitle}">🚨 HIGH-PRIORITY OPPORTUNITY</h1>`;
  html += `<p style="${styles.headerSubtitle}">${urgency.emoji} ${urgency.text.toUpperCase()}</p>`;
  html += `</div>`;
  
  // Giant contact box
  html += `<div style="${styles.section}">`;
  html += generateContactBox(opp, user, true);
  html += `</div>`;
  
  // Opportunity details
  html += `<div style="${styles.section}">`;
  html += `<h2 style="margin: 0 0 10px; font-size: 22px; color: #1a202c;">${opp.title}</h2>`;
  
  if (opp.fit_score) {
    const fitBadge = getFitScoreBadge(opp.fit_score);
    html += `<span style="${styles.badge} background-color: ${fitBadge.color}; color: white; font-size: 14px; padding: 6px 12px;">${opp.fit_score}% FIT SCORE</span>`;
  }
  
  html += `<table style="width: 100%; margin-top: 20px; font-size: 14px;"><tbody>`;
  html += `<tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; width: 140px;"><strong>Agency</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${opp.buyer || opp.department || 'N/A'}</td></tr>`;
  html += `<tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Solicitation #</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${opp.solicitation_number || 'N/A'}</td></tr>`;
  html += `<tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Value Range</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${formatValueRange(opp.estimated_value_low, opp.estimated_value_high)}</td></tr>`;
  html += `<tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>NAICS</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${opp.naics_code || 'N/A'}${opp.naics_description ? ` - ${opp.naics_description}` : ''}</td></tr>`;
  html += `<tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Set-Aside</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${opp.set_aside_description || opp.set_aside_type || 'None'}</td></tr>`;
  html += `<tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Contract Type</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${opp.contract_type || 'N/A'}</td></tr>`;
  html += `<tr><td style="padding: 8px 0;"><strong>Response Due</strong></td><td style="padding: 8px 0; color: #dc3545; font-weight: 700;">${dueDate} ${urgency.emoji}</td></tr>`;
  html += `</tbody></table>`;
  html += `</div>`;
  
  // Questions deadline warning
  if (opp.questions_due_at) {
    const qDays = daysUntil(opp.questions_due_at);
    html += `<div style="${styles.section}">`;
    html += `<div style="background: #fffaf0; border: 2px solid #f6ad55; border-radius: 8px; padding: 15px;">`;
    html += `<strong>⚡ QUESTIONS DEADLINE:</strong> ${new Date(opp.questions_due_at).toLocaleString()}`;
    if (qDays !== null && qDays <= 2) {
      html += `<br><span style="color: #c05621;">Submit questions IMMEDIATELY to get clarification before responding!</span>`;
    }
    html += `</div></div>`;
  }
  
  // Incumbent/competitor intel
  if (opp.incumbent_contractor) {
    html += `<div style="${styles.section}">`;
    html += `<div style="background: #fef5e7; border: 1px solid #f6ad55; border-radius: 8px; padding: 15px;">`;
    html += `<strong>🏆 COMPETITOR INTEL</strong><br>`;
    html += `Current Incumbent: <strong>${opp.incumbent_contractor}</strong><br>`;
    html += `<em style="font-size: 13px; color: #744210;">Research their past performance to identify differentiation opportunities.</em>`;
    html += `</div></div>`;
  }
  
  // Pre-written outreach email
  html += `<div style="${styles.section}">`;
  html += `<h3 style="margin: 0 0 10px; font-size: 16px; color: #1a202c;">📧 Pre-Written Outreach Template</h3>`;
  html += `<div style="background: #f8f9fa; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; font-family: monospace; font-size: 13px; white-space: pre-wrap;">`;
  html += `Subject: Inquiry: ${opp.solicitation_number || opp.title}

Dear ${opp.contracting_officer_name || opp.contact_name || 'Contracting Officer'},

I am writing to express ${user?.company_name || 'our company'}'s interest in ${opp.solicitation_number || 'the above opportunity'}: "${opp.title}".

We have reviewed the requirements and believe we are well-positioned to deliver excellent results based on our experience in ${opp.naics_description || 'this area'}.

I would appreciate the opportunity to:
1. Discuss any additional context on the requirements
2. Understand the evaluation criteria in more detail
3. Schedule a pre-bid meeting or site visit if available

Please let me know your availability for a brief call.

Best regards,
${user?.name || '[Your Name]'}
${user?.company_name || '[Company]'}
${user?.email || '[Email]'}`;
  html += `</div>`;
  
  const mailtoLink = generateMailtoLink(opp, user);
  if (mailtoLink) {
    html += `<div style="margin-top: 15px;">`;
    html += `<a href="${mailtoLink}" style="${styles.buttonUrgent}">📧 Open in Email Client</a>`;
    html += `</div>`;
  }
  html += `</div>`;
  
  // Attachments
  if (opp.attachments && opp.attachments.length > 0) {
    html += `<div style="${styles.section}">`;
    html += `<h3 style="margin: 0 0 10px; font-size: 16px; color: #1a202c;">📎 Solicitation Documents (${opp.attachments.length})</h3>`;
    opp.attachments.forEach(att => {
      html += `<div style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">`;
      html += `<a href="${att.url}" style="${styles.link}">${att.name}</a>`;
      if (att.size_bytes) html += ` <span style="color: #718096; font-size: 12px;">(${Math.round(att.size_bytes / 1024)}KB)</span>`;
      html += `</div>`;
    });
    html += `</div>`;
  }
  
  // Action buttons
  html += `<div style="${styles.section}; text-align: center;">`;
  html += `<a href="${opp.url}" style="${styles.buttonUrgent}">View on SAM.gov</a>`;
  html += `<a href="${dashboardUrl}/opportunities/${opp.id}?action=pursue" style="${styles.button}">I'm Pursuing This</a>`;
  html += `</div>`;
  
  // Footer
  html += `<div style="${styles.footer}">`;
  html += `<p style="${styles.footerText}">This is a high-priority alert from GovBid Scout.<br>`;
  html += `<a href="${dashboardUrl}/settings" style="color: #718096;">Manage alert preferences</a></p>`;
  html += `</div>`;
  
  html += `</div></body></html>`;
  
  // Plain text
  const text = `🚨 HIGH-PRIORITY OPPORTUNITY\n\n` +
    `${opp.title}\n` +
    `Due: ${dueDate} (${urgency.text})\n\n` +
    `CONTACT IMMEDIATELY:\n` +
    `${opp.contracting_officer_name || opp.contact_name || 'N/A'}\n` +
    `Email: ${opp.contracting_officer_email || opp.contact_email || 'N/A'}\n` +
    `Phone: ${opp.contracting_officer_phone || opp.contact_phone || 'N/A'}\n\n` +
    `Agency: ${opp.buyer || 'N/A'}\n` +
    `Value: ${formatValueRange(opp.estimated_value_low, opp.estimated_value_high)}\n` +
    `NAICS: ${opp.naics_code || 'N/A'}\n\n` +
    `View: ${opp.url}\n` +
    `Dashboard: ${dashboardUrl}`;
  
  return { subject, html, text };
};

/
 * Generate Weekly Intelligence Brief
 * @param {Object} params
 * @param {Object} params.user - User profile
 * @param {Object} params.stats - Weekly statistics
 * @param {Array} params.upcomingDeadlines - Opportunities with deadlines this week
 * @param {Array} params.missedOpportunities - Closed opportunities user didn't act on
 * @param {Array} params.activeAgencies - Most active agencies in user's NAICS
 * @param {string} params.dashboardUrl - Dashboard URL
 * @returns {Object} { subject, html, text }
 */
const generateWeeklyBrief = ({ user, stats, upcomingDeadlines, missedOpportunities, activeAgencies, dashboardUrl }) => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7);
  const endDate = new Date();
  const dateRange = `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  
  const subject = `📊 GovBid Scout Weekly Brief — ${dateRange}`;
  
  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="margin: 0; padding: 0; background-color: #f5f5f5;">`;
  html += `<div style="${styles.container}">`;
  
  // Header
  html += `<div style="${styles.header}">`;
  html += `<h1 style="${styles.headerTitle}">📊 Weekly Intelligence Brief</h1>`;
  html += `<p style="${styles.headerSubtitle}">${dateRange}</p>`;
  html += `</div>`;
  
  // Stats overview
  html += `<div style="${styles.section}">`;
  html += `<h2 style="margin: 0 0 15px; font-size: 18px; color: #1a202c;">📈 This Week's Activity</h2>`;
  html += `<table style="width: 100%; border-collapse: collapse;"><tr>`;
  html += `<td style="text-align: center; padding: 15px; border-right: 1px solid #e2e8f0;"><div style="${styles.statNumber}">${stats?.newOpportunities || 0}</div><div style="${styles.statLabel}">New Opportunities</div></td>`;
  html += `<td style="text-align: center; padding: 15px; border-right: 1px solid #e2e8f0;"><div style="${styles.statNumber}">${stats?.pursued || 0}</div><div style="${styles.statLabel}">You Pursued</div></td>`;
  html += `<td style="text-align: center; padding: 15px;"><div style="${styles.statNumber}">${stats?.won || 0}</div><div style="${styles.statLabel}">Won</div></td>`;
  html += `</tr></table>`;
  html += `</div>`;
  
  // Upcoming deadlines
  if (upcomingDeadlines && upcomingDeadlines.length > 0) {
    html += `<div style="${styles.section}">`;
    html += `<h2 style="margin: 0 0 15px; font-size: 18px; color: #dc3545;">⏰ Deadlines This Week</h2>`;
    upcomingDeadlines.slice(0, 5).forEach(opp => {
      const days = daysUntil(opp.due_at);
      const urgency = getUrgencyIndicator(days);
      html += `<div style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">`;
      html += `<strong>${opp.title.substring(0, 50)}${opp.title.length > 50 ? '...' : ''}</strong><br>`;
      html += `<span style="font-size: 13px; color: ${urgency.color};">${urgency.emoji} Due: ${new Date(opp.due_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>`;
      html += ` • <a href="${opp.url}" style="${styles.link}">View</a>`;
      html += `</div>`;
    });
    html += `</div>`;
  }
  
  // Active agencies
  if (activeAgencies && activeAgencies.length > 0) {
    html += `<div style="${styles.section}">`;
    html += `<h2 style="margin: 0 0 15px; font-size: 18px; color: #1a202c;">🏛️ Most Active Agencies in Your NAICS</h2>`;
    activeAgencies.slice(0, 5).forEach((agency, i) => {
      html += `<div style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">`;
      html += `<span style="font-weight: 600;">${i + 1}. ${agency.name}</span>`;
      html += ` <span style="color: #718096;">(${agency.count} opportunities)</span>`;
      html += `</div>`;
    });
    html += `</div>`;
  }
  
  // Missed opportunities
  if (missedOpportunities && missedOpportunities.length > 0) {
    html += `<div style="${styles.section}">`;
    html += `<h2 style="margin: 0 0 15px; font-size: 18px; color: #f6ad55;">😕 You May Have Missed</h2>`;
    html += `<p style="font-size: 14px; color: #718096; margin-bottom: 15px;">These closed recently and matched your profile:</p>`;
    missedOpportunities.slice(0, 3).forEach(opp => {
      html += `<div style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">`;
      html += `<span style="text-decoration: line-through; color: #718096;">${opp.title.substring(0, 50)}${opp.title.length > 50 ? '...' : ''}</span>`;
      html += `<br><span style="font-size: 12px; color: #a0aec0;">Closed: ${new Date(opp.due_at).toLocaleDateString()}</span>`;
      html += `</div>`;
    });
    html += `</div>`;
  }
  
  // Footer
  html += `<div style="${styles.footer}">`;
  html += `<a href="${dashboardUrl}" style="${styles.button}">View Full Dashboard</a>`;
  html += `<p style="${styles.footerText}">Weekly briefs are sent every Sunday at 6pm.<br>`;
  html += `<a href="${dashboardUrl}/settings" style="color: #718096;">Manage preferences</a></p>`;
  html += `</div>`;
  
  html += `</div></body></html>`;
  
  // Plain text
  const text = `GovBid Scout Weekly Brief - ${dateRange}\n\n` +
    `THIS WEEK:\n` +
    `- ${stats?.newOpportunities || 0} new opportunities\n` +
    `- ${stats?.pursued || 0} you pursued\n` +
    `- ${stats?.won || 0} won\n\n` +
    `UPCOMING DEADLINES:\n` +
    (upcomingDeadlines || []).slice(0, 5).map(o => `- ${o.title.substring(0, 40)}... (Due: ${new Date(o.due_at).toLocaleDateString()})`).join('\n') +
    `\n\nView dashboard: ${dashboardUrl}`;
  
  return { subject, html, text };
};

module.exports = {
  generateDailyDigest,
  generateUrgentAlert,
  generateWeeklyBrief,
  generateContactBox,
  generateOpportunityCard,
  generateMailtoLink,
  formatCurrency,
  formatValueRange,
  daysUntil,
  getUrgencyIndicator,
  getFitScoreBadge,
  styles
};