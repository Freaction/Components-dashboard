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
  onSearch
}) => {
  const teamOptions = availableTeams.map(t => ({ label: t.name, value: String(t.id) }));
  const sortOptions = [
    { label: 'By Relevance (Newest Files)', value: 'relevance' },
    { label: 'Alphabetical', value: 'newest' } 
  ];

  return (
    <div className="history-panel" style={{ padding: 'var(--space-4)', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Text variant="xs" weight="bold" color="tertiary" style={{ textTransform: 'uppercase', marginBottom: 'var(--space-4)', display: 'block', flexShrink: 0 }}>
        Analytics & Filters
      </Text>
      
      <Flex direction="column" gap={4} style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }} className="hide-scrollbar">
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
