import React, { useState } from 'react';
import { Node } from './types';
import { Badge } from '../../../components/ui';
import { getBadgeType, getBadgeVariant } from '../../../utils/figmaUtils';

export const TreeNode: React.FC<{ 
  node: Node; 
  sessionId: string; 
  onSelect: (n: Node) => void; 
  selectedId?: string;
  isFiltered?: boolean;
}> = ({ node, sessionId, onSelect, selectedId, isFiltered = false }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [children, setChildren] = useState<Node[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const nodeUniqueId = `${node.file_key}:${node.id}`;

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(node);
    
    // Only expand if the node has children according to the server
    if (node.has_children && !isExpanded && children.length === 0) {
      setIsLoading(true);
      try {
        const res = await fetch(`http://127.0.0.1:3002/nodes?session_id=${sessionId}&parent_id=${node.id}`);
        const data = await res.json();
        setChildren(data.nodes || []);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
      setIsExpanded(true);
    } else if (node.has_children) {
      setIsExpanded(!isExpanded);
    }
  };

  // The logic for universal indentation:
  // 1. If we are in "filtered" mode AND it's a top-level search result (depth 0), we use 0 indentation.
  // 2. Otherwise (not filtered OR child node), we use standard depth-based indentation.
  const nodeDepth = node.depth || 0;
  const paddingLeft = isFiltered && nodeDepth === 0 
    ? 'var(--space-2)' 
    : `calc(${nodeDepth} * var(--space-3) + var(--space-2))`;

  return (
    <div className="tree-node-wrapper">
      <div 
        className={`tree-node ${selectedId === nodeUniqueId ? 'is-selected' : ''}`}
        style={{ 
          paddingLeft,
          paddingRight: 'var(--space-2)',
          height: '24px',
          display: 'flex',
          alignItems: 'center'
        }}
        onClick={handleClick}
      >

        <span className="expand-icon" style={{ 
          width: '16px', 
          display: 'flex', 
          justifyContent: 'center',
          fontSize: '10px',
          color: 'var(--color-text-tertiary)',
          transition: 'transform 0.1s',
          transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
          visibility: node.has_children ? 'visible' : 'hidden',
          flexShrink: 0
        }}>
          {isLoading ? '⌛' : '▶'}
        </span>
        
        <span className="node-name" style={{ 
          marginLeft: 'var(--space-1)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          color: selectedId === nodeUniqueId ? 'var(--color-text-accent)' : (node.is_ghost ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)'),
          fontWeight: selectedId === nodeUniqueId ? 'var(--font-medium)' : 'var(--font-normal)',
          flexGrow: 1, // Fill content
          fontSize: 'var(--text-sm)',
          fontStyle: node.is_ghost ? 'italic' : 'normal',
          textDecoration: node.is_ghost ? 'line-through' : 'none'
        }}>
          {node.is_ghost && <span title="Ghost component (not on canvas)" style={{ marginRight: '4px' }}>👻</span>}
          {node.name || 'Unnamed'}
          {node.instances_count && node.instances_count > 1 && (
            <span style={{ 
              marginLeft: 'var(--space-2)', 
              color: 'var(--color-accent)', 
              fontWeight: 'var(--font-bold)',
              fontSize: '10px',
              background: 'var(--color-bg-accent-soft)',
              padding: '0 4px',
              borderRadius: '4px'
            }}>
              x{node.instances_count}
            </span>
          )}
        </span>

        <Badge 
          variant={getBadgeVariant(node.type) as any}
          style={{ flexShrink: 0, marginLeft: 'var(--space-2)' }}
        >
          {getBadgeType(node.type)}
        </Badge>
      </div>

      {isExpanded && children.map(child => (
        <TreeNode 
          key={`${child.file_key}:${child.id}`} 
          node={{ ...child, depth: nodeDepth + 1 }} 
          sessionId={sessionId} 
          onSelect={onSelect} 
          selectedId={selectedId} 
          isFiltered={isFiltered} 
        />
      ))}
    </div>
  );
};
