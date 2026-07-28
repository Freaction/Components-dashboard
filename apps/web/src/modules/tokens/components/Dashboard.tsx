import React from 'react';
import './Dashboard.css';

interface DashboardProps {
  metrics: any;
}

const healthColor = (score: number) => {
  if (score >= 80) return 'var(--color-health-good)';
  if (score >= 60) return 'var(--color-health-warn)';
  return 'var(--color-health-bad)';
};

const Dashboard: React.FC<DashboardProps> = ({ metrics }) => {
  if (!metrics) return null;

  return (
    <div className="dashboard">
      <div className="dashboard-item">
        <span className="dashboard-label">Total Values</span>
        <span className="dashboard-value">{metrics.totalValues}</span>
      </div>
      <div className="dashboard-divider" />
      <div className="dashboard-item" title="Number of distinct token definitions across the system">
        <span className="dashboard-label">Unique Tokens</span>
        <span className="dashboard-value">{metrics.uniqueTokens}</span>
      </div>
      <div className="dashboard-item">
        <span className="dashboard-label">Varying</span>
        <span className="dashboard-value dashboard-value--good">{metrics.varyingCount}</span>
      </div>
      <div className="dashboard-item dashboard-item--warn" title="Same value across all modes — candidates to move to primitives">
        <span className="dashboard-label">Static</span>
        <span className="dashboard-value dashboard-value--warn">{metrics.staticCount}</span>
        <span className="dashboard-badge">{metrics.staticPct}%</span>
      </div>
      <div className="dashboard-item dashboard-item--warn" title="Missing in at least one mode">
        <span className="dashboard-label">Orphans</span>
        <span className="dashboard-value dashboard-value--warn">{metrics.orphanCount}</span>
        <span className="dashboard-badge">{metrics.orphanPct}%</span>
      </div>
      <div className="dashboard-divider" />
      <div className="dashboard-item dashboard-item--bad" title="Critical: Non-existent alias references">
        <span className="dashboard-label">Broken</span>
        <span className="dashboard-value dashboard-value--bad">{metrics.brokenLinksCount}</span>
      </div>
      <div className="dashboard-item" title="Maximum length of alias chain (ideal depth is 2-3)">
        <span className="dashboard-label">Chain Depth</span>
        <span className="dashboard-value">{metrics.maxAliasDepth}</span>
        {metrics.maxAliasDepthCount > 0 && <span className="dashboard-badge">{metrics.maxAliasDepthCount} tokens</span>}
      </div>
      <div className="dashboard-item dashboard-item--bad" title="Data errors (Cyrillic, empty values, invalid types)">
        <span className="dashboard-label">Errors</span>
        <span className="dashboard-value dashboard-value--bad">{(metrics.criticalErrorsCount || 0) + (metrics.warningErrorsCount || 0)}</span>
      </div>
      <div className="dashboard-item dashboard-item--warn" title="Semantic tokens with literal values instead of aliases">
        <span className="dashboard-label">Hardcoded</span>
        <span className="dashboard-value dashboard-value--warn">{metrics.hardcodedCount}</span>
      </div>
      <div className="dashboard-item" title="Primitive tokens that are not referenced by any other token">
        <span className="dashboard-label">Unused</span>
        <span className="dashboard-value">{metrics.unusedCount}</span>
      </div>
      <div className="dashboard-divider" />
      <div className="dashboard-item">
        <span className="dashboard-label">Health Score</span>
        <span
          className="dashboard-value dashboard-value--health"
          style={{ color: metrics.isFatal ? 'var(--color-health-bad)' : healthColor(metrics.healthScore) }}
          title={metrics.isFatal ? 'FATAL ERRORS DETECTED (Score forced to 0)' : metrics.scoreBreakdown?.map((b: any) => `${b.label}: ${Math.round(b.score)} / ${Math.round(b.weight * 100)}`).join('\n')}
        >
          {metrics.healthScore}
          <span className="dashboard-health-max">/100</span>
        </span>
      </div>
    </div>
  );
};

export default Dashboard;
