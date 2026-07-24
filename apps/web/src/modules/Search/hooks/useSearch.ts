import { useState, useEffect, useCallback } from 'react';

export const useSearch = () => {
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
            console.error('Error fetching teams in useSearch:', e);
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
            setResults(data.nodes || []);

            fetchStats(signal);
        } catch (e: any) {
            if (e.name !== 'AbortError') {
                console.error('Search error:', e);
            }
        } finally {
            setIsLoading(false);
        }
    }, [query, typeFilter, teamFilter, propertyFilters, sortBy, isGrouped, isGlobal, fetchStats]);

    useEffect(() => {
        const controller = new AbortController();
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
    }, [query, typeFilter, teamFilter, propertyFilters, sortBy, isGrouped, isGlobal, performSearch, fetchStats]);

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

    return {
        // state
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
        setSelectedNode,
        // computed actions
        performSearch,
        togglePropertyFilter,
        removePropertyFilter,
        toggleNodeSelection,
        hasSearchOrFilters
    };
};
