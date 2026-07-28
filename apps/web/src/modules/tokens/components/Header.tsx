
import React from 'react';
import { Button } from './ui/Button';
import { ViewSwitcher } from './ViewSwitcher';
import { ViewMode } from '../App';
import { VersionSelector } from './VersionSelector';
import './Header.css';

interface HeaderProps {
  versions: string[];
  selectedVersion: string;
  onVersionChange: (version: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onImport: () => void;
}

const Header: React.FC<HeaderProps> = ({
  versions,
  selectedVersion,
  onVersionChange,
  viewMode,
  onViewModeChange,
  onImport
}) => {
  return (
    <header className="app-header">
      <div className="header-top">
        <div className="header-left">
          <VersionSelector 
            versions={versions} 
            selectedVersion={selectedVersion} 
            onVersionChange={onVersionChange} 
          />
          <div className="view-switcher-wrapper">
            <ViewSwitcher viewMode={viewMode} onViewModeChange={onViewModeChange} />
          </div>
        </div>
        
        <div className="header-actions">
          <Button variant="primary" onClick={onImport}>Import tokens</Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
