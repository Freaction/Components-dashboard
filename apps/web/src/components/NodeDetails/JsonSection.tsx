import React from 'react';
import { Flex, Text } from '../ui';
import styles from './NodeDetails.module.css';

interface JsonSectionProps {
    title: string;
    json?: string;
}

export const JsonSection: React.FC<JsonSectionProps> = ({ title, json }) => {
    if (!json) return null;

    try {
        const data = JSON.parse(json);
        if (!data || (Array.isArray(data) && data.length === 0) || (typeof data === 'object' && Object.keys(data).length === 0)) {
            return null;
        }

        return (
            <Flex direction="column" gap={2} className={styles.sectionLarge}>
                <Text variant="xs" weight="bold" color="tertiary" className={styles.sectionTitle}>{title}</Text>
                <div className={styles.jsonContainer}>
                    <pre className={styles.jsonPre}>
                        {JSON.stringify(data, null, 2)}
                    </pre>
                </div>
            </Flex>
        );
    } catch (e) {
        return null;
    }
};
