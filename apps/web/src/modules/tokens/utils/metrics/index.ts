import { TreeNode } from '../../types';
import { TokenMetrics } from './types';
import { 
  buildGlobalTokenMap, 
  isVarying, 
  isRedundant, 
  isOrphan,
  hasTypeMismatch
} from './core';
import { analyzeAliases } from './alias';
import { findTokenErrors } from './errors';
import { buildSnapshot } from './snapshot';
import { calculateHealthScore } from './score';
import { METRIC_WEIGHTS } from './config';
import { isFoundationPath } from '../token-refs';

export * from './types';
export * from './core';
export * from './usage';
export * from './alias';
export * from './errors';
export * from './snapshot';
export * from './score';
export * from './reasons';

export const computeMetrics = (
  tokensData: Record<string, Record<string, TreeNode>>
): TokenMetrics => {
  const modeCount = Object.keys(tokensData).length;
  if (modeCount === 0) {
    return {
      totalValues: 0, uniqueTokens: 0, semanticTokensCount: 0, primitiveTokensCount: 0, modeCount: 0,
      varyingCount: 0, staticCount: 0, orphanCount: 0,
      staticPct: 0, orphanPct: 0,
      maxAliasDepth: 1, maxAliasDepthCount: 0, brokenLinksCount: 0, brokenPaths: new Set<string>(),
      criticalErrorsCount: 0, criticalErrorPaths: new Set<string>(),
      warningErrorsCount: 0, warningErrorPaths: new Set<string>(),
      hardcodedCount: 0, hardcodedPaths: new Set<string>(),
      unusedCount: 0, unusedPaths: new Set<string>(),
      healthScore: 100, isFatal: false, scoreBreakdown: [],
    };
  }

  const snapshot = buildSnapshot(tokensData);
  const map = buildGlobalTokenMap(tokensData);
  const uniqueTokens = Object.keys(map).length;
  let totalValues = 0;
  let varyingCount = 0;
  let staticCount = 0;
  let orphanCount = 0;

  let primitiveTokensCount = 0;
  let semanticTokensCount = 0;

  Object.entries(map).forEach(([path, entry]) => {
    totalValues += entry.values.length;
    if (isFoundationPath(path)) {
      primitiveTokensCount++;
    } else {
      semanticTokensCount++;
    }
    
    if (isVarying(entry)) varyingCount++;
    else if (isRedundant(entry, modeCount)) staticCount++;
    if (isOrphan(entry, modeCount)) orphanCount++;
  });

  const staticPct = uniqueTokens > 0 ? Math.round((staticCount / uniqueTokens) * 100) : 0;
  const orphanPct = uniqueTokens > 0 ? Math.round((orphanCount / uniqueTokens) * 100) : 0;
  
  const { maxDepth: maxAliasDepth, brokenLinksCount, brokenPaths, maxDepthCount: maxAliasDepthCount } = analyzeAliases(snapshot);
  const { criticalErrorPaths, warningErrorPaths, hardcodedCount, hardcodedPaths, unusedCount, unusedPaths } = findTokenErrors(snapshot);

  // Cross-mode Type Consistency check
  Object.entries(map).forEach(([path, entry]) => {
    if (hasTypeMismatch(entry)) {
      if (isFoundationPath(path)) {
        warningErrorPaths.add(path);
      } else {
        criticalErrorPaths.add(path);
      }
    }
  });

  brokenPaths.forEach(p => criticalErrorPaths.add(p));

  const { score: healthScore, isFatal, breakdown } = calculateHealthScore({
    totalTokens: uniqueTokens,
    criticalErrorsCount: criticalErrorPaths.size,
    hardcodedCount,
    orphansCount: orphanCount,
    warningErrorsCount: warningErrorPaths.size,
    unusedCount,
    maxDepth: maxAliasDepth,
    staticCount,
    primitiveTokensCount,
    semanticTokensCount
  });

  const scoreBreakdown = Object.entries(breakdown).map(([key, metricScore]) => ({
    label: key,
    score: metricScore,
    weight: METRIC_WEIGHTS[key as keyof typeof METRIC_WEIGHTS] || 0,
    contribution: metricScore
  }));

  brokenPaths.forEach(p => criticalErrorPaths.add(p));

  return {
    totalValues,
    uniqueTokens,
    semanticTokensCount,
    primitiveTokensCount,
    modeCount,
    varyingCount,
    staticCount,
    orphanCount,
    staticPct,
    orphanPct,
    maxAliasDepth,
    maxAliasDepthCount,
    brokenLinksCount,
    brokenPaths,
    criticalErrorsCount: criticalErrorPaths.size,
    criticalErrorPaths,
    warningErrorsCount: warningErrorPaths.size,
    warningErrorPaths,
    hardcodedCount,
    hardcodedPaths,
    unusedCount,
    unusedPaths,
    healthScore,
    isFatal,
    scoreBreakdown
  };
};
