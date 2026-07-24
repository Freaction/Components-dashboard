import React from 'react';
import { Flex, ScrollArea, Text, Badge, Button } from '../../components/ui';
import { stripFigmaId, formatPropertyValue } from '../../utils/figmaUtils';
import { NodeDetails } from '../../components/NodeDetails';
import { SearchStats } from './components/SearchStats';
import { SearchFilters } from './components/SearchFilters';
import { GroupedResultsTree } from './components/GroupedResultsTree';
import { useSearch } from './hooks/useSearch';

import styles from './SearchView.module.css';

export const SearchView: React.FC = () => {
  const {
    query, setQuery,
    typeFilter, setTypeFilter,
    teamFilter, setTeamFilter,
    propertyFilters, setPropertyFilters,
    sortBy, setSortBy,
    isGrouped, setIsGrouped,
    isGlobal, setIsGlobal,
    availableTeams,
    results,
    stats,
    isLoading,
    selectedNode,
    performSearch,
    togglePropertyFilter,
    removePropertyFilter,
    toggleNodeSelection,
    hasSearchOrFilters
  } = useSearch();

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
