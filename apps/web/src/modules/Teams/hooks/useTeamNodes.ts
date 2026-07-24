import { useState, useCallback } from 'react';
import { Node } from '../../components/types';
import { getNodesQueryString } from '../../../utils/searchUtils';

export const useTeamNodes = (selectedSession: string | null) => {
    const [rootNodes, setRootNodes] = useState<Node[]>([]);
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);
    const [isLoadingRoots, setIsLoadingRoots] = useState(false);
    const [typeFilter, setTypeFilter] = useState<string[]>([]);

    const fetchRootNodes = useCallback(async (sid: string, types: string[] = []) => {
        console.log(`[TeamsContext] Fetching root nodes for session ${sid}...`);
        setIsLoadingRoots(true);
        try {
            const start = Date.now();
            const queryString = getNodesQueryString(sid, types);
            const res = await fetch(`http://127.0.0.1:3002/nodes?${queryString}`);
            const data = await res.json();
            console.log(`[TeamsContext] Root nodes received in ${Date.now() - start}ms:`, data.nodes?.length);
            setRootNodes(data.nodes || []);
        } catch (e: any) {
            console.error('[TeamsContext] Failed to fetch root nodes:', e);
        }
        setIsLoadingRoots(false);
    }, []);

    const deleteFileNodes = useCallback(async (fileKey: string) => {
        if (!selectedSession) return;
        try {
            await fetch(`http://127.0.0.1:3002/nodes/session/${selectedSession}/file/${fileKey}`, { method: 'DELETE' });
            fetchRootNodes(selectedSession, typeFilter);
        } catch (e) {
            console.error('Failed to delete file nodes:', e);
        }
    }, [selectedSession, typeFilter, fetchRootNodes]);

    return {
        rootNodes,
        setRootNodes,
        selectedNode,
        setSelectedNode,
        isLoadingRoots,
        typeFilter,
        setTypeFilter,
        fetchRootNodes,
        deleteFileNodes,
    };
};
