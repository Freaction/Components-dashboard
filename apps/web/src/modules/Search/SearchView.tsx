import React, { useState, useEffect, useCallback } from 'react';
import { Flex, ScrollArea, Text } from '../../components/ui';
import { NodeDetails } from '../../components/NodeDetails';
import { SearchStats } from './components/SearchStats';
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
  const [stats, setStats] = useState<any>(null);
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

  const fetchStats = useCallback(async (signal?: AbortSignal) => {
    try {
      const url = new URL('http://127.0.0.1:3001/search/global/stats');
      if (query) url.searchParams.append('q', query);
      if (typeFilter.length > 0) {
        typeFilter.forEach(t => url.searchParams.append('type', t));
      }
      if (teamFilter.length > 0) {
        teamFilter.forEach(id => url.searchParams.append('team_id', id));
      }

      const res = await fetch(url.toString(), { signal });
      const data = await res.json();
      setStats(data.stats || null);
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        console.error('Stats fetch error:', e);
      }
    }
  }, [query, typeFilter, teamFilter]);

  const performSearch = useCallback(async (signal?: AbortSignal) => {
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

      const res = await fetch(url.toString(), { signal });
      const data = await res.json();
      const duration = (performance.now() - startTime).toFixed(1);
      console.log(`[SearchView] Search completed in ${duration}ms. Results: ${data.nodes?.length || 0}`);
      setResults(data.nodes || []);
      
      // Fetch stats only when search completes
      fetchStats(signal);
    } catch (e: any) {
      if (e.name === 'AbortError') {
        console.log('[SearchView] Search request aborted');
      } else {
        console.error('Search error:', e);
      }
    } finally {
      setIsLoading(false);
    }
  }, [query, typeFilter, teamFilter, sortBy, fetchStats]);

  useEffect(() => {
    const controller = new AbortController();
    const hasActiveFilters = query.length >= 2 || typeFilter.length > 0 || teamFilter.length > 0;

    if (hasActiveFilters) {
      const debounce = setTimeout(() => performSearch(controller.signal), 500);
      return () => {
        clearTimeout(debounce);
        controller.abort();
      };
    } else {
      setResults([]);
      setStats(null);
    }

    return () => {
      controller.abort();
    };
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
              hasSearched={query.length >= 2 || typeFilter.length > 0 || teamFilter.length > 0}
            />
          </div>
        </div>

        <div className={styles.detailsSidebar}>
          <ScrollArea>
            {selectedNode ? (
              <div className={styles.detailsContent}>
                <NodeDetails node={selectedNode} aggregateStats={stats} />
              </div>
            ) : stats ? (
              <div className={styles.detailsContent}>
                <SearchStats stats={stats} />
              </div>
            ) : (
              <div className={styles.emptyDetails}>
                <Text color="tertiary">Select a node or search to see details</Text>
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
};
