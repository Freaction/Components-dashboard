import React from 'react';
import { Flex, Text, Badge } from '../ui';
import { stripFigmaId, formatPropertyValue, formatCount } from '../../utils/figmaUtils';
import styles from './NodeDetails.module.css';

interface PropertiesSectionProps {
    propsJson?: string;
    aggregateStats: any;
    activePropertyFilters: Array<{ key: string, value: string }>;
    onPropertyClick?: (key: string, value: string) => void;
}

export const PropertiesSection: React.FC<PropertiesSectionProps> = ({
    propsJson,
    aggregateStats,
    activePropertyFilters,
    onPropertyClick
}) => {
    let props: Record<string, any> = {};
    if (propsJson) {
        try {
            props = JSON.parse(propsJson) || {};
        } catch (e) { }
    }

    const isFilterActive = (key: string, value: string) => {
        return activePropertyFilters.some(f => f.key === key && f.value === value);
    };

    if (Object.keys(props).length === 0) {
        return (
            <Flex direction="column" gap={2} className={styles.sectionLarge}>
                <Text variant="xs" weight="bold" color="tertiary" className={styles.sectionTitle}>Properties / Variants</Text>
                <Text variant="sm" color="tertiary" style={{ fontStyle: 'italic' }}>No properties attached to this node.</Text>
            </Flex>
        );
    }

    return (
        <Flex direction="column" gap={2} className={styles.sectionLarge}>
            <Text variant="xs" weight="bold" color="tertiary" className={styles.sectionTitle}>Properties / Variants</Text>
            <div className={styles.propsContainer}>
                {Object.entries(props).map(([key, val]) => {
                    const cleanKey = stripFigmaId(key);

                    let rawValue = val;
                    if (val !== null && typeof val === 'object') {
                        if (val.value !== undefined) rawValue = val.value;
                        else if (val.defaultValue !== undefined) rawValue = val.defaultValue;
                        else rawValue = val.type;
                    }

                    const value = String(rawValue);

                    let globalCount = null;
                    if (aggregateStats && aggregateStats[key]) {
                        const statEntry = aggregateStats[key].find((s: any) => String(s.value) === String(value));
                        if (statEntry) globalCount = statEntry.count;
                    }

                    return (
                        <Flex key={key} justify="space-between" align="center" className={styles.propRow}>
                            <Text variant="sm" color="secondary">{cleanKey}</Text>
                            <Flex gap={2} align="center">
                                <Text variant="sm" weight="medium">{formatPropertyValue(value)}</Text>
                                {globalCount !== null && (
                                    <Badge
                                        variant={isFilterActive(key, value) ? "blue" : "slate"}
                                        className={styles.propBadge}
                                        style={{ cursor: onPropertyClick ? 'pointer' : 'default' }}
                                        onClick={() => onPropertyClick?.(key, value)}
                                    >
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
};
