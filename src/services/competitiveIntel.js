/
 * Competitive Intelligence Service
 * Provides insights on incumbents, agency history, and contracting officer patterns
 * NOTE: Most methods are stubs - full implementation requires USASpending API
 */

const axios = require('axios');

const USA_SPENDING_BASE = 'https://api.usaspending.gov/api/v2';
const FPDS_BASE = 'https://www.fpds.gov/ezsearch/FEEDS/ATOM';

const lookupIncumbent = async (opportunity) => {
  if (opportunity.incumbent_contractor) {
    return {
      found: true,
      incumbent: { name: opportunity.incumbent_contractor, source: 'opportunity_data' }
    };
  }
  
  // TODO: Implement full USASpending API integration
  return {
    found: false,
    message: 'USASpending API integration pending - add USA_SPENDING_API_KEY to enable'
  };
};

const getAgencyHistory = async (agencyName, naicsCode, years = 3) => {
  // TODO: Implement full USASpending API integration
  return {
    agency: agencyName,
    naics_code: naicsCode,
    period: years + ' years',
    data_available: false,
    message: 'USASpending API integration pending',
    expected_data: {
      total_awards: 'Number of awards in this NAICS',
      total_value: 'Total obligated amount',
      top_contractors: 'List of top contractors by value'
    }
  };
};

const getContractingOfficerHistory = async (coEmail, years = 2) => {
  if (!coEmail) return { error: 'No contracting officer email provided' };
  
  // TODO: Implement FPDS/USASpending integration
  return {
    co_email: coEmail,
    period: years + ' years',
    data_available: false,
    message: 'FPDS API integration pending - add FPDS_API_KEY to enable'
  };
};

const generateRecommendations = (opportunity, incumbent, agencyHistory) => {
  const recommendations = [];
  
  if (incumbent && incumbent.found) {
    recommendations.push({
      priority: 'HIGH',
      type: 'competitive',
      action: 'Research incumbent performance',
      detail: incumbent.incumbent.name + ' is the current holder. Research their CPARS ratings.'
    });
  }
  
  if (opportunity.set_aside_type) {
    recommendations.push({
      priority: 'MEDIUM',
      type: 'compliance',
      action: 'Verify set-aside eligibility',
      detail: 'Ensure your ' + opportunity.set_aside_type + ' certification is current.'
    });
  }
  
  if (opportunity.questions_due_at) {
    const daysUntil = Math.ceil((new Date(opportunity.questions_due_at) - new Date()) / (1000 * 60 * 60 * 24));
    if (daysUntil <= 7 && daysUntil > 0) {
      recommendations.push({
        priority: 'URGENT',
        type: 'timeline',
        action: 'Submit questions immediately',
        detail: 'Questions are due in ' + daysUntil + ' days.'
      });
    }
  }
  
  if (opportunity.contracting_officer_email) {
    recommendations.push({
      priority: 'MEDIUM',
      type: 'relationship',
      action: 'Engage contracting officer early',
      detail: 'Send an expression of interest and request a pre-bid meeting.'
    });
  }
  
  return recommendations;
};

const getCompetitiveLandscape = async (opportunity) => {
  const incumbent = await lookupIncumbent(opportunity);
  const agencyHistory = await getAgencyHistory(opportunity.department || opportunity.buyer, opportunity.naics_code);
  
  return {
    opportunity_id: opportunity.id,
    solicitation: opportunity.solicitation_number,
    incumbent: incumbent,
    agency_history: agencyHistory,
    competitive_factors: {
      has_incumbent: incumbent.found,
      is_recompete: incumbent.found,
      set_aside_type: opportunity.set_aside_type || 'Full and Open',
      contract_type: opportunity.contract_type
    },
    recommendations: generateRecommendations(opportunity, incumbent, agencyHistory)
  };
};

const findSimilarAwards = async (criteria) => {
  // TODO: Implement USASpending search
  return {
    criteria: criteria,
    data_available: false,
    message: 'USASpending API integration pending'
  };
};

module.exports = {
  lookupIncumbent,
  getAgencyHistory,
  getContractingOfficerHistory,
  getCompetitiveLandscape,
  findSimilarAwards,
  generateRecommendations,
  USA_SPENDING_BASE,
  FPDS_BASE
};