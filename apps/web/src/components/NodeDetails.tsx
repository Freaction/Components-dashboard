import React, { useState, useEffect } from 'react';
import { Flex, Text, Badge, Button } from './ui';
import { generateFigmaLink, getBadgeType, getBadgeVariant, stripFigmaId, formatCount, formatPropertyValue } from '../utils/figmaUtils';

interface NodeDetailsProps {
  node: any;
  defaultFileKey?: string;
  defaultFileName?: string;
  aggregateStats?: any;
}

export const NodeDetails: React.FC<NodeDetailsProps> = ({ node, defaultFileKey, defaultFileName, aggregateStats }) => {
  const [metadata, setMetadata] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchMetadata = async () => {
      if (!node?.id || !node?.session_id) return;
      setIsLoading(true);
      try {
        const res = await fetch(`http://127.0.0.1:3001/nodes/${node.id}/metadata?session_id=${node.session_id}`);
        const data = await res.json();
        setMetadata(data.metadata || null);
      } catch (e) {
        console.error('Failed to fetch node metadata:', e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMetadata();
  }, [node?.id, node?.session_id]);

  if (!node) return null;

  const getFigmaLink = (n: any, useApp = false) => {
    const fileKey = n.file_key || defaultFileKey || '';
    const fileName = n.file_name || defaultFileName;
    return generateFigmaLink({
      fileKey,
      fileName,
      nodeId: n.id,
      isApp: useApp
    });
  };

  const renderJsonSection = (title: string, json: string) => {
    if (!json) return null;
    try {
      const data = JSON.parse(json);
      if (!data || (Array.isArray(data) && data.length === 0) || (typeof data === 'object' && Object.keys(data).length === 0)) return null;
      
      return (
        <Flex direction="column" gap={2} style={{ marginBottom: 'var(--space-6)' }}>
          <Text variant="xs" weight="bold" color="tertiary" style={{ textTransform: 'uppercase' }}>{title}</Text>
          <div style={{ background: 'var(--color-bg-muted)', padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
            <pre style={{ margin: 0, fontSize: '10px', whiteSpace: 'pre-wrap', color: 'var(--color-text-secondary)' }}>
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        </Flex>
      );
    } catch (e) {
      return null;
    }
  };

  const renderProperties = (propsJson: string) => {
    if (!propsJson) return null;
    try {
      const props = JSON.parse(propsJson);
      if (!props || Object.keys(props).length === 0) return null;
      
      return (
        <Flex direction="column" gap={2} style={{ marginBottom: 'var(--space-6)' }}>
          <Text variant="xs" weight="bold" color="tertiary" style={{ textTransform: 'uppercase' }}>Properties / Variants</Text>
          <div style={{ background: 'var(--color-bg-muted)', padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)' }}>
            {Object.entries(props).map(([key, val]: [string, any]) => {
              const cleanKey = stripFigmaId(key);
              const value = typeof val === 'object' ? val.value || val.type : String(val);
              
              // Get global count if available
              let globalCount = null;
              if (aggregateStats && aggregateStats[key]) {
                const statEntry = aggregateStats[key].find((s: any) => String(s.value) === String(value));
                if (statEntry) globalCount = statEntry.count;
              }

              return (
                <Flex key={key} justify="space-between" align="center" style={{ padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border-base)' }}>
                  <Text variant="sm" color="secondary">{cleanKey}</Text>
                  <Flex gap={2} align="center">
                    <Text variant="sm" weight="medium">{formatPropertyValue(value)}</Text>
                    {globalCount !== null && (
                      <Badge variant="slate" style={{ fontSize: '10px', padding: '0 4px', height: '16px' }}>
                        {formatCount(globalCount)}
                      </Badge>
                    )}
                  </Flex>
                </Flex>
              );
            })}
          </div>
        </Flex>
      );
    } catch (e) {
      return null;
    }
  };

  return (
    <div className="node-details" style={{ padding: 'var(--space-4)' }}>
      <Text variant="xs" weight="bold" color="tertiary" style={{ textTransform: 'uppercase', display: 'block', marginBottom: 'var(--space-6)' }}>
        Node Details
      </Text>
      
      <Flex direction="column" gap={1} style={{ marginBottom: 'var(--space-5)' }}>
        <Text variant="xs" weight="bold" color="tertiary" style={{ textTransform: 'uppercase' }}>Name</Text>
        <Text weight="medium">{stripFigmaId(node.name)}</Text>
      </Flex>

      <Flex direction="column" gap={1} style={{ marginBottom: 'var(--space-5)' }}>
        <Text variant="xs" weight="bold" color="tertiary" style={{ textTransform: 'uppercase' }}>Type</Text>
        <div>
          <Badge variant={getBadgeVariant(node.type) as any}>{getBadgeType(node.type)}</Badge>
        </div>
      </Flex>

      <Flex direction="column" gap={1} style={{ marginBottom: 'var(--space-5)' }}>
        <Text variant="xs" weight="bold" color="tertiary" style={{ textTransform: 'uppercase' }}>Figma ID</Text>
        <div>
          <code className="id-code" style={{ fontSize: '11px', background: 'var(--color-bg-muted)', padding: '2px 4px', borderRadius: '4px' }}>
            {node.id}
          </code>
        </div>
      </Flex>

      {isLoading ? (
        <Text variant="xs" color="tertiary" style={{ padding: 'var(--space-4) 0' }}>Loading metadata...</Text>
      ) : metadata && (
        <>
          {renderProperties(metadata.properties_json)}
          {renderJsonSection('Figma Tokens (Bound Variables)', metadata.bound_variables_json)}
          {renderJsonSection('Fills (Colors)', metadata.fills_json)}
          {renderJsonSection('Strokes', metadata.strokes_json)}
        </>
      )}
      
      <div style={{ marginTop: 'var(--space-8)' }}>
        <a href={getFigmaLink(node, false)} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
          <Button fullWidth>Open in Figma</Button>
        </a>
      </div>
    </div>
  );
};
