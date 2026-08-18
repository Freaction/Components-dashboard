import React, { useState } from 'react';
import './Sidebar.css';
import { TreeNode, Token } from '../types';
import { ChevronRight, ChevronDown, FileJson } from 'lucide-react';
import { ViewMode } from '../App';
import { getAllTokensFromNode, isVarying, isRedundant, isOrphan } from '../utils/metrics';
import { DiffResult } from '../utils/diff';
import { isFoundationPath } from '../utils/token-refs';

interface SidebarProps {
  tree: Record<string, TreeNode>;
  selectedPath: string;
  onSelectPath: (path: string) => void;
  viewMode: ViewMode;
  tokensData: any;
  selectedMode: string;
  globalTokenMap: Record<string, { values: any[]; modes: string[] }> | null;
  modeCount: number;
  metrics?: any;
  diffMap?: any;
  topTokens?: any[];
  usageData?: Record<string, number>;
}

const CATEGORY_ORDER: Record<string, number> = {
  'colors': 1,
  'primitives': 2,
  'typography': 3,
  'numbers': 4,
  'effects': 5
};

const TreeItem: React.FC<{
  node: TreeNode;
  selectedPath: string;
  onSelectPath: (path: string) => void;
  depth: number;
  count: number;
  status: 'none' | 'good' | 'warn' | 'bad';
  pathCounts: Map<string, number>;
  pathStatuses: Map<string, 'none' | 'good' | 'warn' | 'bad'>;
}> = ({ node, selectedPath, onSelectPath, depth, count, status, pathCounts, pathStatuses }) => {
  const [isOpen, setIsOpen] = useState(depth === 0);
  const hasChildren = node.children && Object.keys(node.children).length > 0;
  const isSelected = selectedPath === node.path;

  return (
    <div className="tree-item-container" data-status={status}>
      <div
        className={`tree-item ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => {
          onSelectPath(node.path);
          if (hasChildren) setIsOpen(!isOpen);
        }}
      >
        <div className="tree-item-label-group">
          <span className="icon">
            {hasChildren ? (
              isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />
            ) : <FileJson size={14} />}
          </span>
          <span className="label">{node.name}</span>
        </div>
        {count > 0 && <span className="count">{count}</span>}
      </div>
      {hasChildren && isOpen && (
        <div className="tree-children">
          {Object.keys(node.children).sort().map(name => {
            const childNode = node.children[name];
            return (
              <TreeItem
                key={childNode.path}
                node={childNode}
                selectedPath={selectedPath}
                onSelectPath={onSelectPath}
                depth={depth + 1}
                count={pathCounts.get(childNode.path) || 0}
                status={pathStatuses.get(childNode.path) || 'none'}
                pathCounts={pathCounts}
                pathStatuses={pathStatuses}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

const Sidebar: React.FC<SidebarProps> = ({ tree, selectedPath, onSelectPath, viewMode, globalTokenMap, modeCount, metrics, diffMap, topTokens, usageData }) => {
  const { pathCounts, pathStatuses } = React.useMemo(() => {
    const counts = new Map<string, number>();
    const statuses = new Map<string, 'none' | 'good' | 'warn' | 'bad'>();

    if (!tree) return { pathCounts: counts, pathStatuses: statuses };

    const allTokens = getAllTokensFromNode({ tokens: [], children: tree } as any);
    const topSet = viewMode === 'top20' ? new Set(topTokens?.map(t => t.path) || []) : null;

    allTokens.forEach(t => {
      const path = t.path;
      if (!path) return;
      
      let include = false;
      let s: 'none' | 'good' | 'warn' | 'bad' = 'none';

      if (viewMode === 'explorer') {
        include = true;
      } else if (viewMode === 'top20' && topSet) {
        if (topSet.has(path)) { include = true; s = 'good'; }
      } else if (viewMode === 'compare' && globalTokenMap) {
        if (isVarying(globalTokenMap[path])) include = true;
      } else if (viewMode === 'static' && globalTokenMap) {
        if (isRedundant(globalTokenMap[path], modeCount)) { include = true; s = 'warn'; }
      } else if (viewMode === 'orphans' && globalTokenMap) {
        if (isOrphan(globalTokenMap[path], modeCount)) { include = true; s = 'warn'; }
      } else if (viewMode === 'brokens') {
        if (metrics?.brokenPaths?.has(path)) { include = true; s = 'bad'; }
      } else if (viewMode === 'errors') {
        if (metrics?.criticalErrorPaths?.has(path) || metrics?.warningErrorPaths?.has(path)) { include = true; s = 'bad'; }
      } else if (viewMode === 'hardcoded') {
        if (metrics?.hardcodedPaths?.has(path)) { include = true; s = 'warn'; }
      } else if (viewMode === 'unused') {
        if (metrics?.unusedPaths?.has(path)) { include = true; s = 'warn'; }
      } else if (viewMode === 'team-usage' && usageData) {
        if (t.figmaKey && usageData[t.figmaKey] > 0) { include = true; s = 'good'; }
      } else if (viewMode === 'zero-usage' && usageData) {
        if (t.figmaKey) {
          const usedInComponents = usageData[t.figmaKey] > 0;
          if (isFoundationPath(path)) {
            const unusedInSemantics = metrics?.unusedPaths?.has(path) ?? false;
            if (!usedInComponents && unusedInSemantics) { include = true; s = 'warn'; }
          } else if (!usedInComponents) {
            include = true;
            s = 'warn';
          }
        }
      } else if (viewMode === 'diff' && diffMap) {
        const diffStatus = diffMap.tokenDiffs[path]?.status;
        if (diffStatus && diffStatus !== 'unchanged') {
          include = true;
          if (diffStatus === 'added') s = 'good';
          else if (diffStatus === 'modified') s = 'warn';
          else if (diffStatus === 'removed') s = 'bad';
        }
      }

      if (include) {
        const parts = path.split('/');
        let current = '';
        for (let i = 0; i < parts.length; i++) {
          current = current ? `${current}/${parts[i]}` : parts[i];
          counts.set(current, (counts.get(current) || 0) + 1);
          if (s !== 'none') statuses.set(current, s);
        }
      }
    });

    if (viewMode === 'diff' && diffMap) {
      Object.keys(diffMap.folderDiffs).forEach(folder => {
        const folderStatus = diffMap.folderDiffs[folder];
        if (folderStatus !== 'unchanged') {
          let s: 'none' | 'good' | 'warn' | 'bad' = 'none';
          if (folderStatus === 'added') s = 'good';
          else if (folderStatus === 'modified') s = 'warn';
          else if (folderStatus === 'removed') s = 'bad';
          statuses.set(folder, s);
        }
      });
    }

    return { pathCounts: counts, pathStatuses: statuses };
  }, [tree, viewMode, globalTokenMap, modeCount, metrics, diffMap, topTokens, usageData]);

  if (!tree) return null;

  const sortedRootKeys = Object.keys(tree).sort((a, b) => {
    const orderA = CATEGORY_ORDER[a.toLowerCase()] || 99;
    const orderB = CATEGORY_ORDER[b.toLowerCase()] || 99;
    return orderA - orderB;
  });

  return (
    <aside className="app-sidebar">
      <div className="sidebar-title">Categories</div>
      <div className="tree-root">
        {sortedRootKeys.map(key => {
          const childNode = tree[key];
          return (
            <TreeItem
              key={childNode.path}
              node={childNode}
              selectedPath={selectedPath}
              onSelectPath={onSelectPath}
              depth={0}
              count={pathCounts.get(childNode.path) || 0}
              status={pathStatuses.get(childNode.path) || 'none'}
              pathCounts={pathCounts}
              pathStatuses={pathStatuses}
            />
          );
        })}
      </div>
    </aside>
  );
};

export default Sidebar;
