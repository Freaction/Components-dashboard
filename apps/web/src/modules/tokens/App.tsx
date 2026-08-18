import React, { useState, useEffect, useMemo } from 'react';
import './App.css';
import { useTokens } from './context/TokenContext';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import MainContent from './components/MainContent';
import { useDisplayTokens } from './hooks/useDisplayTokens';
import { useAggregatedTokensUsage } from './hooks/useAggregatedTokensUsage';
import { buildGlobalTokenMap, computeMetrics, getMostUsedTokens, buildSnapshot } from './utils/metrics';
import { getDiffMap } from './utils/diff';
import { EmptyState, Button } from './components/ui';
import { Package } from 'lucide-react';

import { useTeams } from '../Teams';

export type ViewMode = 'explorer' | 'compare' | 'static' | 'orphans' | 'brokens' | 'nodes' | 'errors' | 'hardcoded' | 'unused' | 'diff' | 'top20' | 'redundant' | 'team-usage' | 'zero-usage' | 'ghosts';

function App() {
  const { versions, selectedVersion, setSelectedVersion, tokensData, previousTokensData, loading, error } = useTokens();
  const [selectedMode, setSelectedMode] = useState<string>('');
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('explorer');

  const { teams } = useTeams();
  const usageData = useAggregatedTokensUsage(teams);

  useEffect(() => {
    if (tokensData) {
      const modes = Object.keys(tokensData);
      if (modes.length > 0 && !selectedMode) setSelectedMode(modes[0]);
    }
  }, [tokensData, selectedMode]);

  const globalTokenMap = useMemo(() => {
    if (!tokensData) return null;
    return buildGlobalTokenMap(tokensData);
  }, [tokensData]);

  const modeCount = useMemo(() => {
    return tokensData ? Object.keys(tokensData).length : 0;
  }, [tokensData]);

  const diffMap = useMemo(() => {
    if (viewMode !== 'diff' || !tokensData) return null;
    return getDiffMap(tokensData, previousTokensData, selectedMode);
  }, [viewMode, tokensData, previousTokensData, selectedMode]);

  const metrics = useMemo(() => {
    if (!tokensData) return null;
    return computeMetrics(tokensData);
  }, [tokensData]);

  const topTokens = useMemo(() => {
    if (!tokensData || !globalTokenMap) return [];
    const snap = buildSnapshot(tokensData);
    return getMostUsedTokens(snap).map(s => ({
      path: s.path,
      value: globalTokenMap[s.path]?.values[0] || 'unknown',
      type: s.type,
      usageCount: s.count
    }));
  }, [tokensData, globalTokenMap]);

  const { sidebarTree, displayTokens } = useDisplayTokens(
    viewMode, selectedPath || '', selectedMode,
    tokensData, previousTokensData, globalTokenMap,
    modeCount, diffMap, topTokens, metrics, usageData
  );

  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip,.json,.ts';
    input.multiple = true;
    input.onchange = async (e: any) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      const formData = new FormData();
      Array.from(files).forEach((file: any) => formData.append('files', file));
      try {
        const response = await fetch('/api/import', { method: 'POST', body: formData });
        if (response.ok) {
          alert('Import successful! Refreshing...');
          window.location.reload();
        } else {
          alert('Import failed');
        }
      } catch (err) { alert('Error: ' + err); }
    };
    input.click();
  };

  if (loading) return <div className="status-message">Loading data...</div>;
  if (error) return (
    <div className="status-message error">
      <p>{error}</p>
      <button onClick={() => window.location.reload()}>Retry Connection</button>
    </div>
  );

  return (
    <div className="app-container">
      <Header
        versions={versions}
        selectedVersion={selectedVersion}
        onVersionChange={setSelectedVersion}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onImport={handleImport}
      />

      {metrics && <Dashboard metrics={metrics} />}

      {versions.length === 0 ? (
        <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <EmptyState
            icon={<Package size={64} style={{ opacity: 0.2 }} />}
            title="Design System is Empty"
            description="Welcome to the Tokens Dashboard! To get started, please import your Design Tokens (ZIP or JSON) exported from Figma or your build tools."
            action={
              <Button variant="primary" onClick={handleImport}>
                Import Design Tokens
              </Button>
            }
          />
        </div>
      ) : (
        <div className="app-body">
          <Sidebar
            tree={sidebarTree}
            selectedPath={selectedPath || ''}
            onSelectPath={setSelectedPath}
            viewMode={viewMode}
            tokensData={tokensData}
            selectedMode={selectedMode}
            globalTokenMap={globalTokenMap}
            modeCount={modeCount}
            metrics={metrics}
            diffMap={diffMap}
            topTokens={topTokens}
            usageData={usageData}
          />

          <MainContent
            viewMode={viewMode}
            tokensData={tokensData}
            selectedMode={selectedMode}
            setSelectedMode={setSelectedMode}
            globalTokenMap={globalTokenMap}
            modeCount={modeCount}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            selectedPath={selectedPath || ''}
            setSelectedPath={setSelectedPath}
            topTokens={topTokens}
            displayTokens={displayTokens}
            diffMap={diffMap}
            usageData={usageData}
          />
        </div>
      )}
    </div>
  );
}

export default App;
