/
 * Outreach Generator Service
 * Generates professional, tailored outreach emails for government contracting
 */

const formatDate = (date) => {
  if (!date) return 'TBD';
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
};

const generateIntroEmail = (opportunity, userProfile) => {
  const opp = opportunity;
  const user = userProfile || {};
  const recipientEmail = opp.contracting_officer_email || opp.contact_email;
  const recipientName = opp.contracting_officer_name || opp.contact_name || 'Contracting Officer';
  const subject = 'Expression of Interest: ' + (opp.solicitation_number || opp.title);
  
  const body = 'Dear ' + recipientName + ',\n\n' +
    'I am writing on behalf of ' + (user.company_name || '[Company Name]') + ' to express our strong interest in ' +
    (opp.solicitation_number ? 'Solicitation ' + opp.solicitation_number : 'the referenced opportunity') + ': "' + opp.title + '".\n\n' +
    'ABOUT OUR COMPANY:\n' +
    (user.company_name || '[Company Name]') + ' is ' + (user.company_description || 'a qualified contractor with extensive experience in this domain') + '.\n\n' +
    'REQUEST:\n' +
    '1. Confirmation of receipt of this expression of interest\n' +
    '2. Any additional information about requirements or evaluation criteria\n' +
    '3. Opportunity for a pre-bid meeting or site visit, if available\n\n' +
    'Best regards,\n' +
    (user.name || '[Your Name]') + '\n' +
    (user.company_name || '[Company Name]') + '\n' +
    (user.email || '[Email]');

  const mailto = recipientEmail ? 
    'mailto:' + recipientEmail + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body) : null;
  
  return { subject, body, mailto, recipientEmail };
};

const generateQuestionEmail = (opportunity, questions, userProfile) => {
  const opp = opportunity;
  const user = userProfile || {};
  const recipientEmail = opp.contracting_officer_email || opp.contact_email;
  const recipientName = opp.contracting_officer_name || opp.contact_name || 'Contracting Officer';
  const subject = 'Questions Regarding ' + (opp.solicitation_number || 'Solicitation') + ': ' + opp.title.substring(0, 50);
  
  const formattedQuestions = (questions || []).map((q, i) => (i + 1) + '. ' + q).join('\n\n');
  
  const body = 'Dear ' + recipientName + ',\n\n' +
    'Reference: ' + (opp.solicitation_number || opp.title) + '\n' +
    'Questions Deadline: ' + formatDate(opp.questions_due_at) + '\n\n' +
    (user.company_name || 'Our company') + ' respectfully submits the following questions:\n\n' +
    'QUESTIONS:\n\n' +
    (formattedQuestions || '[Insert your questions here]') + '\n\n' +
    'Respectfully,\n' +
    (user.name || '[Your Name]') + '\n' +
    (user.company_name || '[Company Name]');

  const mailto = recipientEmail ? 
    'mailto:' + recipientEmail + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body) : null;
  
  return { subject, body, mailto, recipientEmail };
};

const generateCapabilityStatement = (opportunity, companyInfo) => {
  const opp = opportunity;
  const company = companyInfo || {};
  const highlights = [];
  
  if (opp.naics_code && company.naics_codes && company.naics_codes.includes(opp.naics_code)) {
    highlights.push('Primary NAICS ' + opp.naics_code + ' matches your capability');
  }
  
  const content = '\n' +
    '===============================================================================\n' +
    '                         CAPABILITY STATEMENT\n' +
    '                    Tailored for: ' + (opp.solicitation_number || opp.title) + '\n' +
    '===============================================================================\n\n' +
    'COMPANY OVERVIEW\n' +
    '-------------------------------------------------------------------------------\n' +
    'Company Name:     ' + (company.name || '[Company Name]') + '\n' +
    'CAGE Code:        ' + (company.cage_code || '[CAGE Code]') + '\n' +
    'DUNS/UEI:         ' + (company.duns || company.uei || '[DUNS/UEI]') + '\n' +
    'Business Size:    ' + (company.size || '[Small/Large Business]') + '\n\n' +
    'CORE COMPETENCIES\n' +
    '-------------------------------------------------------------------------------\n' +
    (company.core_competencies ? company.core_competencies.map(c => '* ' + c).join('\n') : '* [Core Competency 1]\n* [Core Competency 2]') + '\n\n' +
    'CONTACT INFORMATION\n' +
    '-------------------------------------------------------------------------------\n' +
    'Primary Contact:  ' + (company.contact_name || '[Contact Name]') + '\n' +
    'Phone:            ' + (company.phone || '[Phone]') + '\n' +
    'Email:            ' + (company.email || '[Email]') + '\n' +
    '===============================================================================\n';

  return { content, highlights };
};

const generateFollowUpEmail = (opportunity, userProfile, submissionDate) => {
  const opp = opportunity;
  const user = userProfile || {};
  const recipientEmail = opp.contracting_officer_email || opp.contact_email;
  const subject = 'Follow-Up: ' + (opp.solicitation_number || 'Proposal') + ' Submission';
  
  const body = 'Dear ' + (opp.contracting_officer_name || 'Contracting Officer') + ',\n\n' +
    'I am writing to follow up on our proposal submission for ' + (opp.solicitation_number || 'the referenced solicitation') + '.\n\n' +
    'Our proposal was submitted on ' + formatDate(submissionDate) + '.\n\n' +
    'We wanted to confirm receipt and inquire about the evaluation timeline.\n\n' +
    'Best regards,\n' + (user.name || '[Your Name]');

  return { subject, body, mailto: recipientEmail ? 'mailto:' + recipientEmail + '?subject=' + encodeURIComponent(subject) : null };
};

const generatePreBidRequest = (opportunity, userProfile) => {
  const opp = opportunity;
  const user = userProfile || {};
  const recipientEmail = opp.contracting_officer_email || opp.contact_email;
  const subject = 'Pre-Bid Meeting Request: ' + (opp.solicitation_number || opp.title);
  
  const body = 'Dear ' + (opp.contracting_officer_name || 'Contracting Officer') + ',\n\n' +
    (user.company_name || 'Our company') + ' requests a pre-bid meeting for ' + (opp.solicitation_number || 'the above solicitation') + '.\n\n' +
    'We are flexible on scheduling.\n\n' +
    'Respectfully,\n' + (user.name || '[Your Name]');

  return { subject, body, mailto: recipientEmail ? 'mailto:' + recipientEmail + '?subject=' + encodeURIComponent(subject) : null };
};

module.exports = {
  generateIntroEmail,
  generateQuestionEmail,
  generateCapabilityStatement,
  generateFollowUpEmail,
  generatePreBidRequest,
  formatDate
};