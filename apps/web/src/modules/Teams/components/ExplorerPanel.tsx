import React, { useMemo } from 'react';
import { useTeams } from '../TeamsContext';
import { Node } from './types';
import { TreeNode } from './TreeNode';
import { Flex, Text, VirtuosoScroller, Select } from '../../../components/ui';
import { NodeDetails } from '../../../components/NodeDetails';
import { NODE_TYPE_OPTIONS } from '../../../utils/searchUtils';
import { ExternalLink, Trash2 } from 'lucide-react';
import { Virtuoso } from 'react-virtuoso';

type ExplorerRow = 
  | { type: 'file'; name: string; fileKey: string; key: string }
  | { type: 'node'; data: Node; key: string };

export const ExplorerPanel: React.FC = () => {
  const {
    selectedTeam, selectedSession, rootNodes, isLoadingRoots,
    selectedNode, setSelectedNode, files,
    typeFilter, setTypeFilter, deleteFileNodes
  } = useTeams();

  const defaultFileKey = files[0]?.file_key;
  const defaultFileName = files[0]?.file_name;

  const flatRows = useMemo(() => {
    const rows: ExplorerRow[] = [];
    const groupedByFile = rootNodes.reduce((acc, node) => {
      const fileName = node.file_name || 'Unknown File';
      if (!acc[fileName]) acc[fileName] = [];
      acc[fileName].push(node);
      return acc;
    }, {} as Record<string, Node[]>);

    Object.entries(groupedByFile).forEach(([fileName, nodes]) => {
      const firstNode = nodes[0];
      rows.push({ 
        type: 'file', 
        name: fileName, 
        fileKey: firstNode?.file_key || '', 
        key: `file-${fileName}` 
      });
      
      nodes.forEach(node => {
        rows.push({ 
          type: 'node', 
          data: node, 
          key: `node-${node.id}` 
        });
      });
    });
    return rows;
  }, [rootNodes]);

  if (!selectedTeam) {
    return (
      <div className="explorer-panel">
        <div className="empty-state">Select a team to browse layers</div>
      </div>
    );
  }

  const renderRow = (index: number, row: ExplorerRow) => {
    if (row.type === 'file') {
      const fileUrl = `https://www.figma.com/file/${row.fileKey}`;
      return (
        <div style={{ 
          padding: 'var(--space-2) var(--space-3)', 
          background: 'var(--color-bg-subtle)', 
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border-muted)',
          margin: 'var(--space-4) var(--space-4) var(--space-2) 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <Text variant="xs" weight="bold" color="primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '14px' }}>📄</span> {row.name.toUpperCase()}
          </Text>
          <Flex align="center" gap={3}>
            <button 
              onClick={() => {
                if (window.confirm('Remove this file data from the current scan session?')) {
                  deleteFileNodes?.(row.fileKey);
                }
              }}
              style={{ 
                background: 'none', 
                border: 'none', 
                cursor: 'pointer', 
                color: 'var(--color-text-tertiary)',
                display: 'flex',
                alignItems: 'center',
                padding: '4px',
                borderRadius: '4px',
                transition: 'all 0.2s'
              }}
              title="Remove this file's data from this session"
            >
              <Trash2 size={14} />
            </button>
            <a 
              href={fileUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="external-link-icon"
              style={{ color: 'var(--color-text-tertiary)', display: 'flex', alignItems: 'center' }}
            >
              <ExternalLink size={14} />
            </a>
          </Flex>
        </div>
      );
    }

    return (
      <div style={{ paddingRight: 'var(--space-4)' }}>
        <TreeNode 
          node={typeFilter.length > 0 ? { ...row.data, depth: 0 } : row.data} 
          sessionId={selectedSession!} 
          onSelect={setSelectedNode}
          selectedId={selectedNode?.id}
          isFiltered={typeFilter.length > 0}
        />
      </div>
    );
  };

  return (
    <div className="explorer-panel" style={{ padding: 'var(--space-4)' }}>
      {selectedSession ? (
        <Flex style={{ height: '100%' }}>
          <Flex direction="column" style={{ flex: 1, borderRight: '1px solid var(--color-border-base)', overflow: 'hidden', position: 'relative' }}>
            <Flex 
              justify="space-between" 
              align="center" 
              style={{ 
                marginBottom: 'var(--space-3)', 
                flexShrink: 0,
                paddingRight: 'var(--space-4)'
              }}
            >
              <Flex direction="column" gap={1}>
                <Text variant="xs" weight="bold" color="tertiary" style={{ textTransform: 'uppercase' }}>
                  Layer Explorer
                </Text>
                {isLoadingRoots && <Text variant="xs" color="tertiary">Loading...</Text>}
              </Flex>
              
              <div style={{ width: '180px' }}>
                <Select 
                  options={NODE_TYPE_OPTIONS}
                  value={typeFilter}
                  onChange={setTypeFilter}
                  placeholder="All Types"
                  multiSelect
                  fullWidth
                />
              </div>
            </Flex>
            
            <div style={{ flex: 1, position: 'relative' }}>
              <Virtuoso
                data={flatRows}
                itemContent={renderRow}
                style={{ height: '100%' }}
                components={{ Scroller: VirtuosoScroller }}
                className="hide-scrollbar"
              />
            </div>
          </Flex>

          <Flex direction="column" style={{ width: '320px', background: 'var(--color-bg-surface)', paddingLeft: 'var(--space-4)' }}>
            {selectedNode ? (
              <NodeDetails 
                node={selectedNode} 
                defaultFileKey={defaultFileKey} 
                defaultFileName={defaultFileName} 
              />
            ) : (
              <div className="empty-state">Select a node to see details</div>
            )}
          </Flex>

        </Flex>
      ) : (
        <div className="empty-state">Select a scan version to browse layers</div>
      )}
    </div>
  );
};




