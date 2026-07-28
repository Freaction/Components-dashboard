import { METRIC_WEIGHTS, THRESHOLDS } from './config';

export const calculateHealthScore = (counts: {
  totalTokens: number;
  criticalErrorsCount: number; // Contains BrokenRefs, Circular, Semantic Errors
  hardcodedCount: number;
  orphansCount: number;
  warningErrorsCount: number; // Data errors in primitives
  unusedCount: number;
  maxDepth: number;
  staticCount: number;
  primitiveTokensCount: number;
  semanticTokensCount: number;
}) => {
  if (counts.totalTokens === 0) {
    return { score: 0, isFatal: false, breakdown: {} };
  }

  // 1. Check Fatal conditions
  if (counts.criticalErrorsCount > 0) {
    return {
      score: 0,
      isFatal: true,
      breakdown: {
        criticalErrors: 0, // Score multiplier is 0
      }
    };
  }

  const breakdown: Record<string, number> = {};

  // Helper to calculate score for a metric
  // If count is 0, metric score is 100 * weight
  // If count > 0, we deduct points based on percentage of affected tokens
  const calculateMetricScore = (name: keyof typeof METRIC_WEIGHTS, affectedCount: number, baseTotal: number, thresholdPct = 0) => {
    const weight = METRIC_WEIGHTS[name];
    if (!weight) return 0; // Not a warning metric or not defined
    
    if (baseTotal === 0 || affectedCount === 0) {
      breakdown[name] = 100 * weight;
      return 100 * weight;
    }

    const affectedPct = (affectedCount / baseTotal) * 100;
    
    // Calculate penalty (linear scale: if 100% of tokens affected, score for this metric is 0)
    let penaltyPct = affectedPct;

    if (thresholdPct > 0) {
      if (affectedPct <= thresholdPct) {
        penaltyPct = 0;
      } else {
        // Only penalize the amount OVER the threshold
        penaltyPct = ((affectedPct - thresholdPct) / (100 - thresholdPct)) * 100;
      }
    }

    const metricScore = Math.max(0, (100 - penaltyPct) * weight);
    breakdown[name] = metricScore;
    return metricScore;
  };

  let totalScore = 0;
  
  totalScore += calculateMetricScore('hardcoded', counts.hardcodedCount, counts.semanticTokensCount || 1);
  totalScore += calculateMetricScore('orphans', counts.orphansCount, counts.totalTokens);
  totalScore += calculateMetricScore('dataErrors', counts.warningErrorsCount, counts.totalTokens);
  totalScore += calculateMetricScore('unused', counts.unusedCount, counts.primitiveTokensCount || 1, THRESHOLDS.unusedAllowancePct);
  totalScore += calculateMetricScore('staticTokens', counts.staticCount, counts.totalTokens);

  // Alias depth penalty
  const depthWeight = METRIC_WEIGHTS.aliasDepth;
  if (counts.maxDepth <= THRESHOLDS.maxAliasDepth) {
    const s = 100 * depthWeight;
    breakdown.aliasDepth = s;
    totalScore += s;
  } else {
    // Penalty scales with how far over the threshold
    const overage = counts.maxDepth - THRESHOLDS.maxAliasDepth;
    const penaltyFactor = Math.min(1, overage * 0.2); // 20% penalty per level over threshold
    const s = 100 * (1 - penaltyFactor) * depthWeight;
    breakdown.aliasDepth = s;
    totalScore += Math.max(0, s);
  }

  // namingW3C is not yet implemented in findTokenErrors, give full score
  breakdown.namingW3C = 100 * METRIC_WEIGHTS.namingW3C;
  totalScore += breakdown.namingW3C;

  return {
    score: Math.round(totalScore),
    isFatal: false,
    breakdown
  };
};
