import React from 'react';
import './VersionSelector.css';

interface VersionSelectorProps {
  versions: string[];
  selectedVersion: string;
  onVersionChange: (version: string) => void;
}

export const VersionSelector: React.FC<VersionSelectorProps> = ({ versions, selectedVersion, onVersionChange }) => {
  return (
    <div className="version-selector">
      <label>Version:</label>
      <div className="select-wrapper">
        <select value={selectedVersion} onChange={(e) => onVersionChange(e.target.value)}>
          {versions.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="chevron-icon">
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </div>
    </div>
  );
};
