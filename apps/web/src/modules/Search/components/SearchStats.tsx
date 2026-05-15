import React from 'react';
import { Flex, Text, Badge } from '../../../components/ui';
import { stripFigmaId, formatCount, formatPropertyValue } from '../../../utils/figmaUtils';

interface SearchStatsProps {
  stats: Record<string, Array<{ value: string, count: number }>>;
  title?: string;
  limit?: number;
}

export const SearchStats: React.FC<SearchStatsProps> = ({ stats, title = "Global Search Statistics", limit = 10 }) => {
  if (!stats || Object.keys(stats).length === 0) return null;

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
      
      <Flex direction="column" gap={6} style={{ width: '100%' }}>
        {Object.entries(stats).slice(0, limit).map(([prop, values]) => (
          <Flex key={prop} direction="column" gap={2} style={{ width: '100%' }}>
            <Text variant="xs" weight="bold" color="secondary" style={{ wordBreak: 'break-word', opacity: 0.8 }}>
              {stripFigmaId(prop)}
            </Text>
            
            <div style={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              gap: '6px',
              width: '100%'
            }}>
              {values.slice(0, 10).map((v) => (
                <Badge 
                  key={v.value} 
                  variant="slate" 
                  style={{ 
                    fontSize: '11px', 
                    padding: '2px 6px',
                    height: '22px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <Text variant="xs" style={{ display: 'inline', color: 'inherit' }}>
                    {formatPropertyValue(v.value)}: 
                  </Text>
                  <Text variant="xs" weight="bold" style={{ display: 'inline', color: 'inherit' }}>
                    {formatCount(v.count)}
                  </Text>
                </Badge>
              ))}
              {values.length > 10 && (
                <Text variant="xs" color="tertiary" style={{ alignSelf: 'center', fontSize: '10px' }}>
                  +{values.length - 10} more
                </Text>
              )}
            </div>
          </Flex>
        ))}
      </Flex>
    </div>
  );
};
