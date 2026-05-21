import React from 'react';
import { Flex, Text, Badge } from '../../../components/ui';
import { stripFigmaId, formatCount, formatPropertyValue } from '../../../utils/figmaUtils';

interface SearchStatsProps {
  stats: Record<string, Array<{ value: string, count: number }>>;
  title?: string;
  onPropertyClick?: (key: string, value: string) => void;
  activeFilters?: Array<{ key: string, value: string }>;
}

export const SearchStats: React.FC<SearchStatsProps> = ({ 
  stats, 
  title = "Global Search Statistics",
  onPropertyClick,
  activeFilters = []
}) => {
  if (!stats || Object.keys(stats).length === 0) return null;

  const isFilterActive = (key: string, value: string) => {
    return activeFilters.some(f => f.key === key && f.value === value);
  };

  return (
    <div style={{ padding: 'var(--space-4)', width: '100%', boxSizing: 'border-box' }}>
      <Text
        variant="xs"
        weight="bold"
        color="tertiary"
        style={{ textTransform: 'uppercase', display: 'block', marginBottom: 'var(--space-5)' }}
      >
        {title}
      </Text>

      <Flex direction="column" gap={12} style={{ width: '100%' }}>
        {Object.entries(stats).map(([prop, values]) => (
          <Flex key={prop} direction="column" gap={4} style={{ width: '100%' }}>
            <Text variant="xs" weight="bold" color="secondary" style={{ wordBreak: 'break-word', opacity: 0.8 }}>
              {stripFigmaId(prop)}
            </Text>

            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px',
              width: '100%'
            }}>
              {values.map((v) => (
                <Badge
                  key={v.value}
                  variant={isFilterActive(prop, v.value) ? "blue" : "slate"}
                  style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap',
                    cursor: onPropertyClick ? 'pointer' : 'default',
                    transition: 'all 0.1s ease-in-out'
                  }}
                  onClick={() => onPropertyClick?.(prop, v.value)}
                >
                  <Text variant="xs" style={{ display: 'inline', color: 'inherit' }}>
                    {formatPropertyValue(v.value)}:
                  </Text>
                  <Text variant="xs" weight="bold" style={{ display: 'inline', color: 'inherit' }}>
                    {formatCount(v.count)}
                  </Text>
                </Badge>
              ))}
            </div>
          </Flex>
        ))}
      </Flex>
    </div>
  );
};
