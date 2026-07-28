export interface MetricBreakdown {
  label: string;
  score: number;
  weight: number;
  contribution: number; // score * weight
}

export interface TokenMetrics {
  totalValues: number;
  uniqueTokens: number;
  semanticTokensCount: number;
  primitiveTokensCount: number;
  modeCount: number;
  varyingCount: number;
  staticCount: number;
  orphanCount: number;
  staticPct: number;
  orphanPct: number;
  maxAliasDepth: number;
  maxAliasDepthCount: number;
  
  brokenLinksCount: number;
  brokenPaths: Set<string>;
  
  // Splitting errors into critical (semantics) and warning (primitives)
  criticalErrorsCount: number; 
  criticalErrorPaths: Set<string>;
  warningErrorsCount: number;
  warningErrorPaths: Set<string>;
  
  hardcodedCount: number;
  hardcodedPaths: Set<string>;
  
  unusedCount: number;
  unusedPaths: Set<string>;
  
  w3cErrorCount?: number;
  w3cErrorPaths?: Set<string>;
  
  healthScore: number;
  isFatal: boolean;
  scoreBreakdown: MetricBreakdown[];
}
