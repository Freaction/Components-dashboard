import React, { useMemo, useRef } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { Flex, Text, VirtuosoScroller } from '../../../components/ui';
import { TreeNode } from '../../Teams/components/TreeNode';
import { formatRelativeDate } from '../../../utils/searchUtils';

interface GroupedResultsTreeProps {
  results: any[];
  isLoading: boolean;
  selectedNode: any | null;
  setSelectedNode: (node: any) => void;
  hasSearched?: boolean;
}

type FlatRow = 
  | { type: 'team'; name: string; key: string }
  | { type: 'file'; name: string; relativeDate: string; key: string }
  | { type: 'page'; name: string; count: number; key: string }
  | { type: 'node'; data: any; key: string };

export const GroupedResultsTree: React.FC<GroupedResultsTreeProps> = ({
  results,
  isLoading,
  selectedNode,
  setSelectedNode,
  hasSearched = false
}) => {
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  const flatRows = useMemo(() => {
    const rows: FlatRow[] = [];
    
    const grouped = results.reduce((acc: any, node: any) => {
      const teamName = node.team_name || 'Unknown Team';
      const fileName = node.file_name || 'Unknown File';
      const pageName = node.page_name || 'Nodes'; 

      if (!acc[teamName]) acc[teamName] = {};
      if (!acc[teamName][fileName]) acc[teamName][fileName] = {};
      if (!acc[teamName][fileName][pageName]) acc[teamName][fileName][pageName] = [];
      
      acc[teamName][fileName][pageName].push(node);
      return acc;
    }, {});

    Object.entries(grouped).forEach(([teamName, files]: [string, any]) => {
      rows.push({ type: 'team', name: teamName, key: `team-${teamName}` });
      
      Object.entries(files).forEach(([fileName, pages]: [string, any]) => {
        const firstPageNodes = Object.values(pages)[0] as any[];
        const lastModified = firstPageNodes?.[0]?.file_last_modified;
        const relativeDate = formatRelativeDate(lastModified);
        
        rows.push({ type: 'file', name: fileName, relativeDate, key: `file-${teamName}-${fileName}` });
        
        Object.entries(pages).forEach(([pageName, nodes]: [string, any]) => {
          rows.push({ type: 'page', name: pageName, count: nodes.length, key: `page-${teamName}-${fileName}-${pageName}` });
          
          nodes.forEach((node: any) => {
            rows.push({ type: 'node', data: node, key: `node-${node.session_id}-${node.id}` });
          });
        });
      });
    });

    return rows;
  }, [results]);

  const renderRow = (index: number, row: FlatRow) => {
    switch (row.type) {
      case 'team':
        return (
          <div style={{ padding: 'var(--space-2) var(--space-4)', background: 'var(--color-bg-muted)', borderBottom: '1px solid var(--color-border-muted)' }}>
            <Text variant="xs" weight="bold" color="tertiary" style={{ textTransform: 'uppercase' }}>
              👥 Team: {row.name}
            </Text>
          </div>
        );
      case 'file':
        return (
          <div style={{ padding: 'var(--space-3) var(--space-4) var(--space-1) var(--space-4)', marginTop: 'var(--space-2)' }}>
            <Flex align="center" justify="space-between">
              <Text variant="sm" weight="medium" color="secondary">📄 File: {row.name}</Text>
              {row.relativeDate && (
                <Text variant="xs" color="tertiary" style={{ fontStyle: 'italic' }}>
                  {row.relativeDate}
                </Text>
              )}
            </Flex>
          </div>
        );
      case 'page':
        return (
          <div style={{ padding: 'var(--space-1) var(--space-4) var(--space-1) calc(var(--space-4) + 12px)' }}>
            <Text variant="xs" weight="bold" color="tertiary" style={{ display: 'block', textTransform: 'uppercase' }}>
              🔖 Page: {row.name} ({row.count})
            </Text>
          </div>
        );
      case 'node':
        return (
          <div style={{ padding: '0 var(--space-4) 0 calc(var(--space-4) + 24px)' }}>
            <TreeNode 
              node={{ ...row.data, depth: 0 }}
              sessionId={row.data.session_id}
              onSelect={setSelectedNode}
              selectedId={selectedNode?.id}
              isFiltered={true}
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div style={{ height: '100%', width: '100%', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      {results.length > 0 ? (
        <Virtuoso
          ref={virtuosoRef}
          data={flatRows}
          itemContent={renderRow}
          style={{ height: '100%' }}
          increaseViewportBy={300}
          className="hide-scrollbar"
          components={{ Scroller: VirtuosoScroller }}
        />
      ) : (
        <div className="empty-state" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <Text color="tertiary">
            {isLoading ? 'Searching...' : (hasSearched ? 'No results found.' : 'Enter a query (min 3 chars) or select filters to search.')}
          </Text>
        </div>
      )}
    </div>
  );
};
