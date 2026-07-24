import React, { useState, useEffect, useCallback } from 'react';
import { Flex, ScrollArea, Text, Badge, Button } from '../../components/ui';
import { stripFigmaId, formatPropertyValue } from '../../utils/figmaUtils';
import { NodeDetails } from '../../components/NodeDetails';
import { SearchStats } from './components/SearchStats';
import { SearchFilters } from './components/SearchFilters';
import { GroupedResultsTree } from './components/GroupedResultsTree';

import styles from './SearchView.module.css';

export const SearchView: React.FC = () => {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [teamFilter, setTeamFilter] = useState<string[]>([]);
  const [propertyFilters, setPropertyFilters] = useState<Array<{ key: string, value: string }>>([]);
  const [sortBy, setSortBy] = useState<string>('relevance');
  const [isGrouped, setIsGrouped] = useState(false);
  const [isGlobal, setIsGlobal] = useState(false);
  const [availableTeams, setAvailableTeams] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState<any | null>(null);

  const fetchTeams = async () => {
    try {
      const res = await fetch('http://127.0.0.1:3002/teams');
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
      const url = new URL('http://127.0.0.1:3002/search/global/stats');
      if (query) url.searchParams.append('q', query);
      if (typeFilter.length > 0) {
        url.searchParams.append('type', typeFilter.join(','));
      }
      if (teamFilter.length > 0) {
        url.searchParams.append('team_id', teamFilter.join(','));
      }
      if (propertyFilters.length > 0) {
        url.searchParams.append('props', JSON.stringify(propertyFilters));
      }

      const res = await fetch(url.toString(), { signal });
      const data = await res.json();
      setStats(data.stats || null);
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        console.error('Stats fetch error:', e);
      }
    }
  }, [query, typeFilter, teamFilter, propertyFilters]);

  const performSearch = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    const startTime = performance.now();
    console.log(`[SearchView] Starting search for "${query}" (grouped: ${isGrouped}, global: ${isGlobal})...`);
    try {
      const url = new URL('http://127.0.0.1:3002/search/global');
      if (query) url.searchParams.append('q', query);
      if (isGrouped) url.searchParams.append('grouped', 'true');
      if (isGlobal) url.searchParams.append('global_group', 'true');
      if (typeFilter.length > 0) {
        url.searchParams.append('type', typeFilter.join(','));
      }
      if (teamFilter.length > 0) {
        url.searchParams.append('team_id', teamFilter.join(','));
      }
      if (propertyFilters.length > 0) {
        url.searchParams.append('props', JSON.stringify(propertyFilters));
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
  }, [query, typeFilter, teamFilter, propertyFilters, sortBy, isGrouped, isGlobal, fetchStats]);

  useEffect(() => {
    const controller = new AbortController();
    // A search is considered active if we have a text query OR any filter selected
    const hasActiveFilters =
      (query && query.length >= 2) ||
      typeFilter.length > 0 ||
      teamFilter.length > 0 ||
      propertyFilters.length > 0;

    if (hasActiveFilters) {
      const debounce = setTimeout(() => performSearch(controller.signal), 500);
      return () => {
        clearTimeout(debounce);
        controller.abort();
      };
    } else {
      setResults([]);
      fetchStats(controller.signal);
    }

    return () => {
      controller.abort();
    };
  }, [query, typeFilter, teamFilter, propertyFilters, sortBy, isGrouped, isGlobal, performSearch]);

  const togglePropertyFilter = (key: string, value: string) => {
    setPropertyFilters(prev => {
      const exists = prev.find(p => p.key === key && p.value === value);
      if (exists) {
        return prev.filter(p => !(p.key === key && p.value === value));
      } else {
        return [...prev, { key, value }];
      }
    });
  };

  const removePropertyFilter = (key: string, value: string) => {
    setPropertyFilters(prev => prev.filter(p => !(p.key === key && p.value === value)));
  };

  const toggleNodeSelection = (node: any) => {
    setSelectedNode((prev: any) => (prev?.id === node?.id && prev?.file_key === node?.file_key ? null : node));
  };

  const hasSearchOrFilters = (query && query.length >= 2) || typeFilter.length > 0 || teamFilter.length > 0 || propertyFilters.length > 0;

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
        setPropertyFilters={setPropertyFilters}
        isGrouped={isGrouped}
        setIsGrouped={setIsGrouped}
        isGlobal={isGlobal}
        setIsGlobal={setIsGlobal}
      />

      <div className={styles.explorerPanel}>
        <div className={styles.resultsArea}>
          <div className={styles.resultsHeader}>
            <Flex justify="space-between" align="center">
              <Text variant="xs" weight="bold" color="tertiary" style={{ textTransform: 'uppercase' }}>
                Search Results {results.length > 0 && `(${results.length})`}
              </Text>
            </Flex>

            {propertyFilters.length > 0 && (
              <Flex gap={6} style={{ marginTop: 'var(--space-3)', flexWrap: 'wrap' }}>
                {propertyFilters.map(p => (
                  <Badge
                    key={`${p.key}-${p.value}`}
                    variant="blue"
                    style={{ cursor: 'pointer', height: '18px', padding: '0 6px', fontSize: '10px' }}
                    onClick={() => removePropertyFilter(p.key, p.value)}
                  >
                    <Text variant="xs" style={{ color: 'inherit', fontSize: '10px' }}>
                      {stripFigmaId(p.key)}: {formatPropertyValue(p.value)} ✕
                    </Text>
                  </Badge>
                ))}
                <Button variant="ghost" size="xs" onClick={() => setPropertyFilters([])} style={{ height: '18px', padding: '0 4px', fontSize: '10px' }}>Clear all</Button>
              </Flex>
            )}
          </div>

          <div className={styles.resultsContent}>
            <GroupedResultsTree
              results={results}
              isLoading={isLoading}
              selectedNode={selectedNode}
              setSelectedNode={toggleNodeSelection}
              hasSearched={hasSearchOrFilters}
              isGlobal={isGlobal}
            />
          </div>
        </div>

        <div className={styles.detailsSidebar}>
          <ScrollArea>
            {selectedNode ? (
              <div className={styles.detailsContent}>
                <NodeDetails
                  node={selectedNode}
                  aggregateStats={stats}
                  onPropertyClick={togglePropertyFilter}
                  activePropertyFilters={propertyFilters}
                />
              </div>
            ) : stats ? (
              <div className={styles.detailsContent}>
                <SearchStats
                  stats={stats}
                  onPropertyClick={togglePropertyFilter}
                  activeFilters={propertyFilters}
                />
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
