/
 * Fit Scorer Service
 * Calculates how well an opportunity matches a profile's criteria
 */

const logger = require('../utils/logger');

function scoreFit(profile, opportunity) {
  let score = 0;
  const reasons = [];

  // NAICS match: +30 points
  if (profile.naics_codes && profile.naics_codes.length > 0 && opportunity.naics) {
    const oppNaics = String(opportunity.naics);
    const naicsMatch = profile.naics_codes.some(code => {
      const profileCode = String(code);
      return oppNaics.startsWith(profileCode) || profileCode.startsWith(oppNaics);
    });
    
    if (naicsMatch) {
      score += 30;
      reasons.push('NAICS code ' + opportunity.naics + ' matches profile criteria');
    }
  }

  // Keywords include: +20 points
  if (profile.keywords_include && profile.keywords_include.length > 0) {
    const text = ((opportunity.title || '') + ' ' + (opportunity.description || '')).toLowerCase();
    const matchedKeywords = profile.keywords_include.filter(kw => text.includes(kw.toLowerCase()));
    
    if (matchedKeywords.length > 0) {
      const keywordScore = Math.min(20, matchedKeywords.length * 5);
      score += keywordScore;
      reasons.push('Keywords found: ' + matchedKeywords.join(', '));
    }
  }

  // Set-aside match: +15 points
  if (profile.set_asides && profile.set_asides.length > 0 && opportunity.set_aside) {
    const setAsideMatch = profile.set_asides.some(sa => {
      const profileSa = sa.toLowerCase();
      const oppSa = opportunity.set_aside.toLowerCase();
      return profileSa === oppSa || oppSa.includes(profileSa);
    });
    
    if (setAsideMatch) {
      score += 15;
      reasons.push('Set-aside ' + opportunity.set_aside + ' matches profile preference');
    }
  }

  // State match: +15 points
  if (profile.states && profile.states.length > 0 && opportunity.state) {
    if (profile.states.includes(opportunity.state)) {
      score += 15;
      reasons.push('State ' + opportunity.state + ' is in target area');
    }
  }

  // Value in range: +10 points
  if (opportunity.value_min !== null || opportunity.value_max !== null) {
    const oppValue = opportunity.value_max || opportunity.value_min;
    const profileMin = profile.value_min || 0;
    const profileMax = profile.value_max || Infinity;
    
    if (oppValue >= profileMin && oppValue <= profileMax) {
      score += 10;
      reasons.push('Contract value $' + oppValue.toLocaleString() + ' within target range');
    }
  }

  // Due date > 7 days: +10 points
  if (opportunity.response_due_at) {
    const dueDate = new Date(opportunity.response_due_at);
    const now = new Date();
    const daysUntilDue = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
    
    if (daysUntilDue > 7) {
      score += 10;
      reasons.push(daysUntilDue + ' days until deadline - adequate response time');
    } else if (daysUntilDue > 0) {
      score += 5;
      reasons.push(daysUntilDue + ' days until deadline - tight timeline');
    } else {
      reasons.push('Deadline has passed or is today');
    }
  }

  // Keywords exclude: -20 points
  if (profile.keywords_exclude && profile.keywords_exclude.length > 0) {
    const text = ((opportunity.title || '') + ' ' + (opportunity.description || '')).toLowerCase();
    const excludeMatches = profile.keywords_exclude.filter(kw => text.includes(kw.toLowerCase()));
    
    if (excludeMatches.length > 0) {
      score -= 20;
      reasons.push('Excluded keywords found: ' + excludeMatches.join(', '));
    }
  }

  // Level preference bonus
  if (profile.levels && profile.levels.length > 0 && opportunity.level) {
    if (profile.levels.includes(opportunity.level)) {
      score += 5;
      reasons.push('Procurement level ' + opportunity.level + ' matches preference');
    }
  }

  score = Math.max(0, Math.min(100, score));

  logger.debug('Opportunity scored', {
    opportunityId: opportunity.id,
    externalId: opportunity.external_id,
    score,
    reasonCount: reasons.length,
  });

  return { score, reasons };
}

function scoreBatch(profile, opportunities) {
  return opportunities.map(opp => {
    const { score, reasons } = scoreFit(profile, opp);
    return { ...opp, fit_score: score, fit_reasons: reasons };
  }).sort((a, b) => b.fit_score - a.fit_score);
}

function getScoringCriteria() {
  return {
    max_score: 100,
    criteria: [
      { name: 'NAICS match', points: 30, description: 'Opportunity NAICS code matches profile codes' },
      { name: 'Keywords include', points: 20, description: 'Title/description contains target keywords' },
      { name: 'Set-aside match', points: 15, description: 'Set-aside type matches profile preferences' },
      { name: 'State match', points: 15, description: 'Opportunity is in target state(s)' },
      { name: 'Value in range', points: 10, description: 'Contract value within target range' },
      { name: 'Response time', points: 10, description: 'More than 7 days until deadline' },
      { name: 'Level preference', points: 5, description: 'Federal/state/local level matches' },
    ],
    penalties: [
      { name: 'Keywords exclude', points: -20, description: 'Excluded keywords found in title/description' },
    ],
  };
}

module.exports = { scoreFit, scoreBatch, getScoringCriteria };