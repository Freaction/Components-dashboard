import React from 'react';
import { Text } from '../ui';
import styles from './NodeDetails.module.css';

interface GhostWarningProps {
    isGhost?: boolean;
}

export const GhostWarning: React.FC<GhostWarningProps> = ({ isGhost }) => {
    if (!isGhost) return null;

    return (
        <div className={styles.ghostBlock}>
            <Text variant="sm" weight="bold" className={styles.ghostTitle}>
                👻 Ghost Component
            </Text>
            <Text variant="xs" className={styles.ghostText}>
                This node exists in the file metadata but is <b>not placed on any page</b>.
                The link below might open the file but fail to select the node.
            </Text>
        </div>
    );
};
