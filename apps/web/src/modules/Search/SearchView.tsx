import React, { useState, useEffect, useCallback } from 'react';
import { Flex, ScrollArea, Text } from '../../components/ui';
import { NodeDetails } from '../../components/NodeDetails';
import { SearchFilters } from './components/SearchFilters';
import { GroupedResultsTree } from './components/GroupedResultsTree';

import styles from './SearchView.module.css';

export const SearchView: React.FC = () => {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [teamFilter, setTeamFilter] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<string>('relevance');
  const [availableTeams, setAvailableTeams] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState<any | null>(null);

  const fetchTeams = async () => {
    try {
      const res = await fetch('http://127.0.0.1:3001/teams');
      const data = await res.json();
      setAvailableTeams(data.teams || []);
    } catch (e) {
      console.error('Error fetching teams in SearchView:', e);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  const performSearch = useCallback(async () => {
    setIsLoading(true);
    const startTime = performance.now();
    console.log(`[SearchView] Starting search for "${query}"...`);
    try {
      const url = new URL('http://127.0.0.1:3001/search/global');
      if (query) url.searchParams.append('q', query);
      if (typeFilter.length > 0) {
        typeFilter.forEach(t => url.searchParams.append('type', t));
      }
      if (teamFilter.length > 0) {
        teamFilter.forEach(id => url.searchParams.append('team_id', id));
      }
      const sortValue = Array.isArray(sortBy) ? sortBy[0] : sortBy;
      if (sortValue) url.searchParams.append('sort', sortValue);
      
      const res = await fetch(url.toString());
      const data = await res.json();
      const duration = (performance.now() - startTime).toFixed(1);
      console.log(`[SearchView] Search completed in ${duration}ms. Results: ${data.nodes?.length || 0}`);
      setResults(data.nodes || []);
    } catch (e) {
      console.error('Search error:', e);
    } finally {
      setIsLoading(false);
    }
  }, [query, typeFilter, teamFilter, sortBy]);

  useEffect(() => {
    const hasActiveFilters = query.length >= 3 || typeFilter.length > 0 || teamFilter.length > 0;
    if (hasActiveFilters) {
      const debounce = setTimeout(performSearch, 500);
      return () => clearTimeout(debounce);
    } else {
      setResults([]);
    }
  }, [query, typeFilter, teamFilter, sortBy, performSearch]);

  return (
    <div className={styles.container}>
      <SearchFilters 
        query={query}
        setQuery={setQuery}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        teamFilter={teamFilter}
        setTeamFilter={setTeamFilter}
        availableTeams={availableTeams}
        isLoading={isLoading}
        onSearch={performSearch}
        sortBy={sortBy}
        setSortBy={setSortBy}
      />

      <div className={styles.explorerPanel}>
        <div className={styles.resultsArea}>
          <div className={styles.resultsHeader}>
            <Text variant="xs" weight="bold" color="tertiary" style={{ textTransform: 'uppercase' }}>
              Search Results {results.length > 0 && `(${results.length})`}
            </Text>
          </div>
          
          <div className={styles.resultsContent}>
            <GroupedResultsTree 
              results={results}
              isLoading={isLoading}
              selectedNode={selectedNode}
              setSelectedNode={setSelectedNode}
              hasSearched={query.length >= 3 || typeFilter.length > 0 || teamFilter.length > 0}
            />
          </div>
        </div>

        <div className={styles.detailsSidebar}>
          <ScrollArea>
            {selectedNode ? (
              <div className={styles.detailsContent}>
                <NodeDetails node={selectedNode} />
              </div>
            ) : (
              <div className={styles.emptyDetails}>
                <Text color="tertiary">Select a node to see details</Text>
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
};
