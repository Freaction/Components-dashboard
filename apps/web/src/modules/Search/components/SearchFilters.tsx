import React from 'react';
import { Text, Flex, Input, Button, Select } from '../../../components/ui';
import { NODE_TYPE_OPTIONS } from '../../../utils/searchUtils';

interface SearchFiltersProps {
  query: string;
  setQuery: (q: string) => void;
  typeFilter: string[];
  setTypeFilter: (t: string[]) => void;
  teamFilter: string[];
  setTeamFilter: (t: string[]) => void;
  sortBy: string | string[];
  setSortBy: (s: any) => void;
  availableTeams: any[];
  isLoading: boolean;
  onSearch: () => void;
  setPropertyFilters: (p: any[]) => void;
  isGrouped: boolean;
  setIsGrouped: (v: boolean) => void;
  isGlobal: boolean;
  setIsGlobal: (v: boolean) => void;
}

export const SearchFilters: React.FC<SearchFiltersProps> = ({
  query,
  setQuery,
  typeFilter,
  setTypeFilter,
  teamFilter,
  setTeamFilter,
  sortBy,
  setSortBy,
  availableTeams = [],
  isLoading,
  onSearch,
  setPropertyFilters,
  isGrouped,
  setIsGrouped,
  isGlobal,
  setIsGlobal
}) => {
  const teamOptions = availableTeams.map(t => ({ label: t.name, value: String(t.id) }));
  const sortOptions = [
    { label: 'Relevance (Search Only)', value: 'relevance' },
    { label: 'Newest Files First', value: 'newest' },
    { label: 'Alphabetical', value: 'alphabetical' }
  ];

  const handleClearAll = () => {
    setQuery('');
    setTypeFilter([]);
    setTeamFilter([]);
    setSortBy('relevance');
    setPropertyFilters([]);
    setIsGrouped(false);
    setIsGlobal(false);
  };

  const handleGroupToggle = () => {
    const newVal = !isGrouped;
    setIsGrouped(newVal);
    if (!newVal) setIsGlobal(false);
  };

  return (
    <div className="history-panel" style={{ padding: 'var(--space-4)', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Flex align="center" justify="space-between" style={{ marginBottom: 'var(--space-4)' }}>
        <Text variant="xs" weight="bold" color="tertiary" style={{ textTransform: 'uppercase' }}>
          Analytics & Filters
        </Text>
        <Text 
          variant="xs" 
          color="accent" 
          style={{ cursor: 'pointer', textDecoration: 'underline' }}
          onClick={handleClearAll}
        >
          Clear All
        </Text>
      </Flex>
      
      <Flex direction="column" gap={4} style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }} className="hide-scrollbar">
        <div 
          onClick={handleGroupToggle}
          style={{ 
            padding: 'var(--space-3)', 
            background: 'var(--color-bg-surface)', 
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            border: '1px solid var(--color-border-base)',
            boxShadow: 'var(--shadow-sm)',
            transition: 'all 0.15s ease-in-out'
          }}
        >
          <Flex align="center" justify="space-between">
            <div style={{ flex: 1, marginRight: 'var(--space-3)' }}>
              <Text variant="sm" weight="bold">
                Group identical nodes
              </Text>
              <Text variant="xs" color="tertiary" style={{ marginTop: '2px', display: 'block', lineHeight: '1.4' }}>
                Collapse duplicates within pages
              </Text>
            </div>
            <div style={{ 
              width: '36px', 
              height: '20px', 
              background: isGrouped ? 'var(--color-bg-primary)' : 'var(--color-text-tertiary)',
              borderRadius: '10px',
              position: 'relative',
              transition: 'background 0.2s',
              flexShrink: 0
            }}>
              <div style={{ 
                width: '14px', 
                height: '14px', 
                background: 'white', 
                borderRadius: '50%', 
                position: 'absolute',
                top: '3px',
                left: isGrouped ? '19px' : '3px',
                transition: 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
              }} />
            </div>
          </Flex>
        </div>

        <div 
          onClick={() => isGrouped && setIsGlobal(!isGlobal)}
          style={{ 
            padding: 'var(--space-3)', 
            background: 'var(--color-bg-surface)', 
            borderRadius: 'var(--radius-md)',
            cursor: isGrouped ? 'pointer' : 'not-allowed',
            border: '1px solid var(--color-border-base)',
            boxShadow: 'var(--shadow-sm)',
            transition: 'all 0.15s ease-in-out',
            opacity: isGrouped ? 1 : 0.5,
            marginBottom: 'var(--space-2)'
          }}
        >
          <Flex align="center" justify="space-between">
            <div style={{ flex: 1, marginRight: 'var(--space-3)' }}>
              <Text variant="sm" weight="bold">
                Global Workspace view
              </Text>
              <Text variant="xs" color="tertiary" style={{ marginTop: '2px', display: 'block', lineHeight: '1.4' }}>
                Group across all files and teams
              </Text>
            </div>
            <div style={{ 
              width: '36px', 
              height: '20px', 
              background: isGlobal ? 'var(--color-bg-primary)' : 'var(--color-text-tertiary)',
              borderRadius: '10px',
              position: 'relative',
              transition: 'background 0.2s',
              flexShrink: 0
            }}>
              <div style={{ 
                width: '14px', 
                height: '14px', 
                background: 'white', 
                borderRadius: '50%', 
                position: 'absolute',
                top: '3px',
                left: isGlobal ? '19px' : '3px',
                transition: 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
              }} />
            </div>
          </Flex>
        </div>

        <div>
          <Text variant="xs" weight="bold" color="secondary" style={{ marginBottom: 'var(--space-2)', display: 'block' }}>Sort By</Text>
          <Select 
            options={sortOptions}
            value={sortBy}
            onChange={setSortBy}
            placeholder="Sort by..."
            fullWidth
          />
        </div>

        <div>
          <Text variant="xs" weight="bold" color="secondary" style={{ marginBottom: 'var(--space-2)', display: 'block' }}>Teams</Text>
          <Select 
            options={teamOptions}
            value={teamFilter}
            onChange={setTeamFilter}
            placeholder="All Teams"
            multiSelect
            fullWidth
          />
        </div>

        <div>
          <Text variant="xs" weight="bold" color="secondary" style={{ marginBottom: 'var(--space-2)', display: 'block' }}>Node Type</Text>
          <Select 
            options={NODE_TYPE_OPTIONS}
            value={typeFilter}
            onChange={setTypeFilter}
            placeholder="All Types"
            multiSelect
            fullWidth
          />
        </div>

        <div>
          <Text variant="xs" weight="bold" color="secondary" style={{ marginBottom: 'var(--space-2)', display: 'block' }}>Component Name</Text>
          <Input 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Badge, Button..." 
            fullWidth 
          />
        </div>
      </Flex>

      <Button fullWidth variant="primary" style={{ marginTop: 'var(--space-6)', flexShrink: 0 }} onClick={onSearch}>
        {isLoading ? 'Searching...' : 'Search'}
      </Button>
    </div>
  );
};
