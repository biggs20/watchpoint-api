/
 * SAM.gov Adapter
 * Enhanced data extraction for government contracting opportunities
 * Extracts comprehensive contact info, contract details, and documents
 */

const axios = require('axios');

// SAM.gov API base URL
const SAM_API_BASE = 'https://api.sam.gov/opportunities/v2';

// Contract type mappings
const CONTRACT_TYPES = {
  'J': 'Firm Fixed Price (FFP)',
  'K': 'Cost Plus Award Fee',
  'L': 'Cost No Fee',
  'M': 'Cost Plus Fixed Fee',
  'R': 'Cost Plus Incentive Fee',
  'S': 'Cost Sharing',
  'T': 'Time and Materials (T&M)',
  'U': 'Labor Hours',
  'V': 'Time and Materials/Labor Hours',
  'Y': 'Combination',
  'Z': 'To Be Determined',
  'A': 'Fixed Price Incentive',
  'B': 'Fixed Price Redetermination',
  '1': 'Order Dependent (IDIQ/BPA)'
};

// Set-aside type mappings
const SET_ASIDE_TYPES = {
  'SBA': 'Small Business',
  '8A': '8(a) Business Development',
  '8AN': '8(a) Native American',
  'HZC': 'HUBZone',
  'HZS': 'HUBZone Sole Source',
  'SDVOSBC': 'Service-Disabled Veteran-Owned Small Business',
  'SDVOSBS': 'SDVOSB Sole Source',
  'WOSB': 'Women-Owned Small Business',
  'WOSBSS': 'WOSB Sole Source',
  'EDWOSB': 'Economically Disadvantaged WOSB',
  'EDWOSBSS': 'EDWOSB Sole Source',
  'VSA': 'Veteran-Owned Small Business',
  'VSS': 'VOSB Sole Source',
  'BI': 'Buy Indian',
  'ISBEE': 'Indian Small Business Economic Enterprise',
  'IEE': 'Indian Economic Enterprise',
  'NONE': 'No Set-Aside'
};

/
 * Parse SAM.gov contact information
 * @param {Object} contact - Contact object from API
 * @returns {Object} Normalized contact info
 */
const parseContact = (contact) => {
  if (!contact) return {};
  
  return {
    name: contact.fullName || contact.name || 
          [contact.firstName, contact.middleName, contact.lastName]
            .filter(Boolean).join(' ') || null,
    email: contact.email || null,
    phone: contact.phone || contact.phoneNumber || null,
    title: contact.title || contact.jobTitle || null,
    fax: contact.fax || null,
    type: contact.type || null
  };
};

/
 * Parse attachment/resource links
 * @param {Array} resources - Resource links from API
 * @returns {Array} Normalized attachments
 */
const parseAttachments = (resources) => {
  if (!resources || !Array.isArray(resources)) return [];
  
  return resources.map(resource => ({
    name: resource.name || resource.filename || 'Unnamed Document',
    url: resource.uri || resource.url || resource.link || null,
    size_bytes: resource.size || resource.fileSize || null,
    type: resource.mimeType || resource.type || inferFileType(resource.name),
    description: resource.description || null,
    posted_date: resource.postedDate || null
  })).filter(a => a.url);
};

/
 * Infer file type from filename
 * @param {string} filename
 * @returns {string}
 */
const inferFileType = (filename) => {
  if (!filename) return 'unknown';
  const ext = filename.split('.').pop().toLowerCase();
  const typeMap = {
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'zip': 'application/zip'
  };
  return typeMap[ext] || 'application/octet-stream';
};

/
 * Parse amendments/modifications
 * @param {Array} relatedNotices - Related notices from API
 * @returns {Array} Normalized amendments
 */
const parseAmendments = (relatedNotices) => {
  if (!relatedNotices || !Array.isArray(relatedNotices)) return [];
  
  return relatedNotices
    .filter(notice => notice.type === 'AMENDMENT' || notice.type === 'MODIFICATION')
    .map(notice => ({
      number: notice.number || notice.amendmentNumber || null,
      date: notice.postedDate || notice.date || null,
      summary: notice.description || notice.subject || null,
      url: notice.uri || notice.url || null,
      notice_id: notice.noticeId || null
    }));
};

/
 * Parse place of performance
 * @param {Object} pop - Place of performance object
 * @returns {string} Formatted address
 */
const parsePlaceOfPerformance = (pop) => {
  if (!pop) return null;
  
  const parts = [
    pop.streetAddress || pop.street,
    pop.city?.name || pop.city,
    pop.state?.code || pop.state,
    pop.zip || pop.postalCode,
    pop.country?.code || pop.country
  ].filter(Boolean);
  
  return parts.length > 0 ? parts.join(', ') : null;
};

/
 * Parse agency hierarchy
 * @param {Object} hierarchy - Agency hierarchy object
 * @returns {Object} Parsed hierarchy
 */
const parseAgencyHierarchy = (hierarchy) => {
  if (!hierarchy) return {};
  
  return {
    department: hierarchy.departmentName || hierarchy.department || 
                hierarchy.level1?.name || null,
    sub_agency: hierarchy.subTierName || hierarchy.agency || 
                hierarchy.level2?.name || null,
    office: hierarchy.officeName || hierarchy.office || 
            hierarchy.level3?.name || null
  };
};

/
 * Extract estimated value range
 * @param {Object} award - Award/value information
 * @returns {Object} Value range
 */
const parseValueRange = (award) => {
  if (!award) return { low: null, high: null };
  
  return {
    low: award.estimatedMinimum || award.minValue || award.amount || null,
    high: award.estimatedMaximum || award.maxValue || award.ceiling || null
  };
};

/
 * Transform SAM.gov API response to normalized opportunity
 * @param {Object} samOpportunity - Raw API response
 * @returns {Object} Normalized opportunity
 */
const transformOpportunity = (samOpportunity) => {
  const opp = samOpportunity;
  
  // Extract primary point of contact
  const primaryContact = opp.pointOfContact?.find(c => c.type === 'primary') ||
                         opp.pointOfContact?.[0] || {};
  const parsedPrimaryContact = parseContact(primaryContact);
  
  // Extract contracting officer (secondary contact or specific type)
  const contractingOfficer = opp.pointOfContact?.find(c => 
    c.type === 'contracting' || c.type === 'contractingOfficer' || c.type === 'secondary'
  ) || opp.pointOfContact?.[1] || {};
  const parsedCO = parseContact(contractingOfficer);
  
  // Parse agency hierarchy
  const agencyInfo = parseAgencyHierarchy(opp.organizationHierarchy || opp.agency);
  
  // Parse value range
  const valueRange = parseValueRange(opp.award || opp.estimatedValue);
  
  return {
    // Core identifiers
    external_id: opp.noticeId || opp.opportunityId,
    solicitation_number: opp.solicitationNumber || opp.solicitation?.number || null,
    award_number: opp.awardNumber || opp.award?.number || null,
    
    // Basic info
    title: opp.title || opp.subject,
    description: opp.description || opp.synopsis,
    url: opp.uiLink || opp.link || `https://sam.gov/opp/${opp.noticeId}/view`,
    
    // Classification
    naics_code: opp.naicsCode || opp.naics?.code,
    naics_description: opp.naicsDescription || opp.naics?.description,
    psc_code: opp.classificationCode || opp.psc?.code,
    type: opp.type || opp.noticeType,
    
    // Set-aside
    set_aside_type: opp.setAside || opp.typeOfSetAside,
    set_aside_description: SET_ASIDE_TYPES[opp.setAside] || opp.setAsideDescription || null,
    size_standard: opp.naicsSizeStandard || opp.sizeStandard || null,
    
    // Contract details
    contract_type: opp.contractType ? 
      (CONTRACT_TYPES[opp.contractType] || opp.contractType) : null,
    
    // Value range
    estimated_value_low: valueRange.low,
    estimated_value_high: valueRange.high,
    
    // Buyer info
    buyer: agencyInfo.department || opp.agency?.name || opp.department,
    department: agencyInfo.department,
    sub_agency: agencyInfo.sub_agency,
    office: agencyInfo.office,
    
    // Primary Point of Contact
    contact_name: parsedPrimaryContact.name,
    contact_email: parsedPrimaryContact.email,
    contact_phone: parsedPrimaryContact.phone,
    contact_title: parsedPrimaryContact.title,
    
    // Contracting Officer
    contracting_officer_name: parsedCO.name,
    contracting_officer_email: parsedCO.email,
    contracting_officer_phone: parsedCO.phone,
    
    // Location
    place_of_performance: parsePlaceOfPerformance(opp.placeOfPerformance),
    office_address: parsePlaceOfPerformance(opp.officeAddress),
    
    // Dates
    posted_at: opp.postedDate || opp.publishDate,
    due_at: opp.responseDeadLine || opp.responseDueDate || opp.dueDate,
    questions_due_at: opp.questionsDeadline || opp.inquiryDeadline || null,
    archive_date: opp.archiveDate || null,
    
    // Documents
    attachments: parseAttachments(opp.resourceLinks || opp.attachments || opp.documents),
    amendments: parseAmendments(opp.relatedNotices || opp.amendments),
    
    // Award info (for award notices)
    incumbent_contractor: opp.awardee?.name || opp.incumbent || null,
    
    // Parent reference (for amendments)
    parent_notice_id: opp.parentNoticeId || opp.originalNoticeId || null,
    
    // Raw data for reference
    raw_data: opp
  };
};

/
 * Search SAM.gov opportunities
 * @param {Object} params - Search parameters
 * @param {string} apiKey - SAM.gov API key
 * @returns {Promise<Object>} Search results
 */
const searchOpportunities = async (params, apiKey) => {
  const {
    keywords,
    naicsCodes,
    postedFrom,
    postedTo,
    ptype,
    setAside,
    limit = 100,
    offset = 0
  } = params;
  
  const queryParams = new URLSearchParams();
  
  if (keywords) queryParams.append('keywords', keywords);
  if (naicsCodes) queryParams.append('naicsCodes', Array.isArray(naicsCodes) ? naicsCodes.join(',') : naicsCodes);
  if (postedFrom) queryParams.append('postedFrom', postedFrom);
  if (postedTo) queryParams.append('postedTo', postedTo);
  if (ptype) queryParams.append('ptype', ptype);
  if (setAside) queryParams.append('setAside', setAside);
  queryParams.append('limit', limit.toString());
  queryParams.append('offset', offset.toString());
  
  const response = await axios.get(`${SAM_API_BASE}/search`, {
    params: queryParams,
    headers: {
      'X-Api-Key': apiKey,
      'Accept': 'application/json'
    }
  });
  
  const opportunities = (response.data.opportunitiesData || [])
    .map(transformOpportunity);
  
  return {
    opportunities,
    totalRecords: response.data.totalRecords || opportunities.length,
    offset,
    limit
  };
};

/
 * Get single opportunity by notice ID
 * @param {string} noticeId - SAM.gov notice ID
 * @param {string} apiKey - SAM.gov API key
 * @returns {Promise<Object>} Opportunity details
 */
const getOpportunity = async (noticeId, apiKey) => {
  const response = await axios.get(`${SAM_API_BASE}/opportunities/${noticeId}`, {
    headers: {
      'X-Api-Key': apiKey,
      'Accept': 'application/json'
    }
  });
  
  return transformOpportunity(response.data);
};

/
 * Get related notices (amendments, modifications)
 * @param {string} noticeId - Parent notice ID
 * @param {string} apiKey - SAM.gov API key
 * @returns {Promise<Array>} Related notices
 */
const getRelatedNotices = async (noticeId, apiKey) => {
  const response = await axios.get(`${SAM_API_BASE}/opportunities/${noticeId}/related`, {
    headers: {
      'X-Api-Key': apiKey,
      'Accept': 'application/json'
    }
  });
  
  return (response.data.relatedNotices || []).map(transformOpportunity);
};

module.exports = {
  searchOpportunities,
  getOpportunity,
  getRelatedNotices,
  transformOpportunity,
  parseContact,
  parseAttachments,
  parseAmendments,
  CONTRACT_TYPES,
  SET_ASIDE_TYPES
};