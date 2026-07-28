import React from 'react';
import './ViewSwitcher.css';
import { ViewMode } from '../App';

interface ViewSwitcherProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export const ViewSwitcher: React.FC<ViewSwitcherProps> = ({ viewMode, onViewModeChange }) => {
  return (
    <div className="view-switcher-container">
      <div
        className={`view-switcher-item ${viewMode === 'explorer' ? 'active' : ''}`}
        onClick={() => onViewModeChange('explorer')}
      >
        Explorer
      </div>
      <div
        className={`view-switcher-item ${viewMode === 'nodes' ? 'active' : ''}`}
        onClick={() => onViewModeChange('nodes')}
      >
        Nodes
      </div>
      <div
        className={`view-switcher-item ${viewMode === 'compare' ? 'active' : ''}`}
        onClick={() => onViewModeChange('compare')}
      >
        Compare
      </div>
      <div
        className={`view-switcher-item ${viewMode === 'diff' ? 'active' : ''}`}
        onClick={() => onViewModeChange('diff')}
      >
        Diff
      </div>
      <div
        className={`view-switcher-item ${viewMode === 'static' ? 'active' : ''}`}
        onClick={() => onViewModeChange('static')}
      >
        Static
      </div>
      <div
        className={`view-switcher-item ${viewMode === 'orphans' ? 'active' : ''}`}
        onClick={() => onViewModeChange('orphans')}
      >
        Orphans
      </div>
      <div
        className={`view-switcher-item ${viewMode === 'brokens' ? 'active' : ''}`}
        onClick={() => onViewModeChange('brokens')}
      >
        Broken
      </div>
      <div
        className={`view-switcher-item ${viewMode === 'errors' ? 'active' : ''}`}
        onClick={() => onViewModeChange('errors')}
      >
        Errors
      </div>
      <div
        className={`view-switcher-item ${viewMode === 'hardcoded' ? 'active' : ''}`}
        onClick={() => onViewModeChange('hardcoded')}
      >
        Hardcoded
      </div>
      <div
        className={`view-switcher-item ${viewMode === 'unused' ? 'active' : ''}`}
        onClick={() => onViewModeChange('unused')}
      >
        Unused
      </div>
      <div
        className={`view-switcher-item ${viewMode === 'top20' ? 'active' : ''}`}
        onClick={() => onViewModeChange('top20')}
      >
        🔥 High Usage
      </div>
      <div
        className={`view-switcher-item ${viewMode === 'team-usage' ? 'active' : ''}`}
        onClick={() => onViewModeChange('team-usage')}
      >
        Team Usage
      </div>
      <div
        className={`view-switcher-item ${viewMode === 'zero-usage' ? 'active' : ''}`}
        onClick={() => onViewModeChange('zero-usage')}
      >
        Zero Usage
      </div>
      <div
        className={`view-switcher-item ${viewMode === 'ghosts' ? 'active' : ''}`}
        onClick={() => onViewModeChange('ghosts')}
      >
        Ghosts
      </div>
    </div>
  );
};
