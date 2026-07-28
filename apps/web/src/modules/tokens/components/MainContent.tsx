import React, { useState, useEffect } from 'react';
import { ViewMode } from '../App';
import { Token, TreeNode } from '../types';
import ModeGrid from './ModeGrid';
import { Input, EmptyState } from './ui';
import NodeCanvas from './nodes/NodeCanvas';
import TokenList from './TokenList';

interface MainContentProps {
  viewMode: ViewMode;
  tokensData: Record<string, Record<string, TreeNode>> | null;
  selectedMode: string;
  setSelectedMode: (mode: string) => void;
  globalTokenMap: any;
  modeCount: number;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  selectedPath: string;
  setSelectedPath: (path: string | null) => void;
  topTokens: any[];
  displayTokens: Token[];
  diffMap: any;
  usageData: Record<string, number>;
}

const MainContent: React.FC<MainContentProps> = ({
  viewMode,
  tokensData,
  selectedMode,
  setSelectedMode,
  globalTokenMap,
  modeCount,
  searchTerm,
  setSearchTerm,
  selectedPath,
  setSelectedPath,
  topTokens,
  displayTokens,
  diffMap,
  usageData,
}) => {
  const [deadGhostsDict, setDeadGhostsDict] = useState<Record<string, any>>({});
  
  useEffect(() => {
    fetch('/dead_ghosts.json')
      .then(res => res.json())
      .then(data => setDeadGhostsDict(data))
      .catch(() => {});
  }, []);

  return (
    <main className="content">
      <div className="content-toolbar">
        <ModeGrid
          data={tokensData || {}}
          selectedMode={selectedMode}
          onModeChange={setSelectedMode}
          viewMode={viewMode}
          globalTokenMap={globalTokenMap}
          modeCount={modeCount}
        />
        <Input
          placeholder="Search tokens..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      {viewMode === 'nodes' ? (
        <NodeCanvas
          tokensData={tokensData && selectedMode ? tokensData[selectedMode] : null}
          searchTerm={searchTerm}
          selectedPath={selectedPath}
          onSelectPath={path => setSelectedPath(path)}
        />
      ) : viewMode === 'top20' && !selectedPath ? (
        <div className="content-scroll">
          <section className="tokens-section">
            <div className="section-header">
              <h2>🔥 High Usage Tokens</h2>
            </div>
            <TokenList
              tokens={topTokens}
              searchTerm={searchTerm}
              selectedPath="top-20"
              viewMode={viewMode}
              allTokensData={tokensData}
              diffMap={null}
              topTokens={topTokens}
            />
          </section>
        </div>
      ) : viewMode === 'ghosts' ? (
        <div className="content-scroll">
          <section className="tokens-section">
            <div className="section-header">
              <h2>Ghosts (Unrecognized Tokens)</h2>
              <div className="path-breadcrumb">
                <span className="token-count">
                  {Object.keys(usageData).filter(key => {
                  const firstMode = Object.keys(tokensData || {})[0];
                  if (!firstMode || !tokensData) return true;
                  // Check if the id exists in globalTokenMap (which is already built). 
                  // To save iteration, globalTokenMap has unique tokens.
                  return !Object.values(globalTokenMap).some((entry: any) => entry.figmaKey === key);
                }).length} tokens
                </span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {(() => {
                const ghosts = Object.entries(usageData)
                  .filter(([key]) => {
                    const firstMode = Object.keys(tokensData || {})[0];
                    if (!firstMode || !tokensData) return true;
                    return !Object.values(globalTokenMap).some((entry: any) => entry.figmaKey === key);
                  })
                  .map(([key, count]) => {
                    const deadGhost = deadGhostsDict[key];
                    let ghostValue = '?';
                    let resolvedType = 'UNKNOWN';
                    if (deadGhost && deadGhost.valuesByMode) {
                      const firstModeVal = Object.values(deadGhost.valuesByMode)[0];
                      if (typeof firstModeVal === 'object' && firstModeVal !== null) {
                        ghostValue = 'Complex value';
                        if ('r' in firstModeVal) {
                          ghostValue = `rgba(${Math.round((firstModeVal as any).r*255)}, ${Math.round((firstModeVal as any).g*255)}, ${Math.round((firstModeVal as any).b*255)}, ${(firstModeVal as any).a ?? 1})`;
                          resolvedType = 'COLOR';
                        }
                      } else {
                        ghostValue = String(firstModeVal);
                        resolvedType = typeof firstModeVal === 'number' ? 'FLOAT' : 'STRING';
                      }
                    }
                    return {
                      path: (deadGhost && deadGhost.name) ? `ghosts/${deadGhost.name}` : `ghosts/Deleted Token`,
                      description: `Figma Key: ${key} | Deleted Token`,
                      type: resolvedType,
                      value: ghostValue,
                      figmaKey: key,
                      usageCount: count
                    } as any;
                  });

                if (ghosts.length === 0) {
                  return (
                    <div className="space-y-2 pt-8">
                      <EmptyState title="No ghosts" description="No unused/deleted variables found in designs." />
                    </div>
                  );
                }

                return (
                  <TokenList 
                    tokens={ghosts}
                    selectedPath="Ghosts"
                    viewMode="ghosts"
                    allTokensData={tokensData}
                  />
                );
              })()}
            </div>
          </section>
        </div>
      ) : (
        <div className="content-scroll">
          <section className="tokens-section">
            <div className="section-header">
              <h2>
                {viewMode === 'team-usage' 
                  ? `Team Usage: ${selectedPath ? selectedPath.split('/').pop() : 'All Tokens'}` 
                  : viewMode === 'zero-usage'
                  ? `Zero Usage: ${selectedPath ? selectedPath.split('/').pop() : 'All Tokens'}`
                  : (selectedPath ? selectedPath.split('/').pop() : 'All Tokens')}
              </h2>
              <div className="path-breadcrumb">
                <span className="path-text">{selectedPath || 'All Categories'}</span>
                <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs font-medium">
                  {viewMode === 'team-usage' ? displayTokens.filter(t => t.figmaKey && usageData[t.figmaKey]).length : 
                   viewMode === 'zero-usage' ? displayTokens.filter(t => t.figmaKey && !usageData[t.figmaKey]).length :
                   viewMode === 'diff' ? displayTokens.filter(t => diffMap && diffMap[t.figmaKey]).length : displayTokens.length}
                </span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              <TokenList
                tokens={(viewMode === 'team-usage' || viewMode === 'zero-usage') ? displayTokens.map(t => ({ ...t, usageCount: (t.figmaKey && usageData[t.figmaKey]) || 0 })) : displayTokens}
                searchTerm={searchTerm}
                selectedPath={selectedPath || 'All Tokens'}
                viewMode={viewMode}
                allTokensData={tokensData}
                diffMap={diffMap}
                topTokens={topTokens}
              />
            </div>
          </section>
        </div>
      )}
    </main>
  );
};

export default MainContent;
