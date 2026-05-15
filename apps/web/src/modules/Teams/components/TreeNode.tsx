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

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(node);
    
    // Only expand if the node has children according to the server
    if (node.has_children && !isExpanded && children.length === 0) {
      setIsLoading(true);
      try {
        const res = await fetch(`http://localhost:3001/nodes?session_id=${sessionId}&parent_id=${node.id}`);
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
        className={`tree-node ${selectedId === node.id ? 'is-selected' : ''}`}
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
          color: selectedId === node.id ? 'var(--color-text-accent)' : 'var(--color-text-primary)',
          fontWeight: selectedId === node.id ? 'var(--font-medium)' : 'var(--font-normal)',
          flexGrow: 1, // Fill content
          fontSize: 'var(--text-sm)'
        }}>
          {node.name || 'Unnamed'}
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
          key={child.id} 
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
