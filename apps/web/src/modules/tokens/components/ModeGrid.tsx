import React from 'react';
import './ModeGrid.css';
import { ViewMode } from '../App';
import { getAllTokensFromNode, isVarying, isRedundant } from '../utils/metrics';

interface ModeGridProps {
  data: any;
  selectedMode: string;
  onModeChange: (mode: string) => void;
  viewMode: ViewMode;
  globalTokenMap: Record<string, { values: any[]; modes: string[] }> | null;
  modeCount: number;
}

const ModeGrid: React.FC<ModeGridProps> = ({ data, selectedMode, onModeChange, viewMode, globalTokenMap, modeCount }) => {
  const modes = Object.keys(data);

  return (
    <div className="modes-grid-container">
      <div className="modes-grid">
        {modes.map(mode => {
          const modeTokens = getAllTokensFromNode({ tokens: [], children: data[mode] } as any);

          let count = modeTokens.length;

          if (globalTokenMap) {
            if (viewMode === 'compare') {
              count = modeTokens.filter(t => {
                if (!t.path) return false;
                const entry = globalTokenMap[t.path];
                return entry && isVarying(entry);
              }).length;
            } else if (viewMode === 'redundant') {
              count = modeTokens.filter(t => {
                if (!t.path) return false;
                const entry = globalTokenMap[t.path];
                return entry && isRedundant(entry, modeCount);
              }).length;
            }
          }

          return (
            <div
              key={mode}
              className={`mode-stat-item ${selectedMode === mode ? 'active' : ''} ${viewMode === 'redundant' ? 'mode-stat-item--redundant' : ''}`}
              onClick={() => onModeChange(mode)}
              style={{ gap: '8px', alignItems: 'center' }}
            >
              <span className="mode-name">{mode}</span>
              <span className="mode-count" style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ModeGrid;
