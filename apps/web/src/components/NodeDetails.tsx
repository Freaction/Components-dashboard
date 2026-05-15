import React, { useState, useEffect } from 'react';
import { Flex, Text, Badge, Button, ScrollArea } from './ui';
import { generateFigmaLink, getBadgeType, getBadgeVariant } from '../utils/figmaUtils';

interface NodeDetailsProps {
  node: any;
  defaultFileKey?: string;
  defaultFileName?: string;
}

export const NodeDetails: React.FC<NodeDetailsProps> = ({ node, defaultFileKey, defaultFileName }) => {
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
        <Flex direction="column" gap={1} style={{ marginBottom: 'var(--space-5)' }}>
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
        <Flex direction="column" gap={1} style={{ marginBottom: 'var(--space-5)' }}>
          <Text variant="xs" weight="bold" color="tertiary" style={{ textTransform: 'uppercase' }}>Properties / Variants</Text>
          <div style={{ background: 'var(--color-bg-muted)', padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)' }}>
            {Object.entries(props).map(([key, val]: [string, any]) => (
              <Flex key={key} justify="space-between" style={{ padding: 'var(--space-1) 0', borderBottom: '1px solid var(--color-border-base)' }}>
                <Text variant="sm" color="secondary">{key}</Text>
                <Text variant="sm" weight="medium">{typeof val === 'object' ? val.value || val.type : String(val)}</Text>
              </Flex>
            ))}
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
        <Text weight="medium">{node.name}</Text>
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
          <code className="id-code">{node.id}</code>
        </div>
      </Flex>

      {isLoading ? (
        <Text variant="xs" color="tertiary">Loading metadata...</Text>
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
