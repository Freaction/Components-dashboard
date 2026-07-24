import React, { useState, useEffect } from 'react';
import { Flex, Text, Badge, Button } from '../ui';
import { generateFigmaLink, getBadgeType, getBadgeVariant, stripFigmaId } from '../../utils/figmaUtils';
import { JsonSection } from './JsonSection';
import { PropertiesSection } from './PropertiesSection';
import { GhostWarning } from './GhostWarning';
import styles from './NodeDetails.module.css';

interface NodeDetailsProps {
    node: any;
    defaultFileKey?: string;
    defaultFileName?: string;
    aggregateStats?: any;
    onPropertyClick?: (key: string, value: string) => void;
    activePropertyFilters?: Array<{ key: string, value: string }>;
}

export const NodeDetails: React.FC<NodeDetailsProps> = ({
    node,
    defaultFileKey,
    defaultFileName,
    aggregateStats,
    onPropertyClick,
    activePropertyFilters = []
}) => {
    const [metadata, setMetadata] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const fetchMetadata = async () => {
            if (!node?.id || !node?.session_id) return;
            setIsLoading(true);
            try {
                const res = await fetch(`http://127.0.0.1:3002/nodes/${encodeURIComponent(node.id)}/metadata?session_id=${encodeURIComponent(node.session_id)}`);
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

    return (
        <div className={styles.container}>
            <Text variant="xs" weight="bold" color="tertiary" className={styles.headerTitle}>
                Node Details
            </Text>

            <Flex direction="column" gap={1} className={styles.section}>
                <Text variant="xs" weight="bold" color="tertiary" className={styles.sectionTitle}>Name</Text>
                <Text weight="medium">{stripFigmaId(node.name)}</Text>
            </Flex>

            <GhostWarning isGhost={node.is_ghost} />

            <Flex direction="column" gap={1} className={styles.section}>
                <Text variant="xs" weight="bold" color="tertiary" className={styles.sectionTitle}>Type</Text>
                <div>
                    <Badge variant={getBadgeVariant(node.type) as any}>{getBadgeType(node.type)}</Badge>
                </div>
            </Flex>

            <Flex direction="column" gap={1} className={styles.section}>
                <Text variant="xs" weight="bold" color="tertiary" className={styles.sectionTitle}>Figma ID</Text>
                <div>
                    <code className={styles.idCode}>{node.id}</code>
                </div>
            </Flex>

            {isLoading ? (
                <Text variant="xs" color="tertiary" className={styles.loadingText}>Loading metadata...</Text>
            ) : metadata && (
                <>
                    <PropertiesSection
                        propsJson={metadata.properties_json}
                        aggregateStats={aggregateStats}
                        activePropertyFilters={activePropertyFilters}
                        onPropertyClick={onPropertyClick}
                    />
                    <JsonSection title="Figma Tokens (Bound Variables)" json={metadata.bound_variables_json} />
                    <JsonSection title="Fills (Colors)" json={metadata.fills_json} />
                    <JsonSection title="Strokes" json={metadata.strokes_json} />
                </>
            )}

            <div className={styles.openLink}>
                <a href={getFigmaLink(node, false)} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                    <Button fullWidth>Open in Figma</Button>
                </a>
            </div>
        </div>
    );
};
