import { useState, useCallback } from 'react';
import { Team } from '../../components/types';

export const useTeamsList = () => {
    const [teams, setTeams] = useState<Team[]>([]);
    const [selectedTeam, setSelectedTeamState] = useState<string | null>(() => {
        return localStorage.getItem('selected_team_id');
    });
    const [newTeamName, setNewTeamName] = useState('');

    const setSelectedTeam = useCallback((id: string | null) => {
        setSelectedTeamState(id);
        if (id) {
            localStorage.setItem('selected_team_id', id);
        } else {
            localStorage.removeItem('selected_team_id');
        }
    }, []);

    const fetchTeams = useCallback(async (retryCount = 0) => {
        console.log('[TeamsContext] Fetching teams...');
        try {
            const start = Date.now();
            const res = await fetch('http://127.0.0.1:3002/teams');
            if (!res.ok) throw new Error(`HTTP error ${res.status}`);
            const data = await res.json();
            const loadedTeams: Team[] = data.teams || [];
            console.log(`[TeamsContext] Teams received (${loadedTeams.length} teams) in ${Date.now() - start}ms`);
            setTeams(loadedTeams);

            if (loadedTeams.length > 0) {
                setSelectedTeamState(prev => {
                    if (!prev || !loadedTeams.some(t => t.id === prev)) {
                        const firstId = loadedTeams[0].id;
                        localStorage.setItem('selected_team_id', firstId);
                        return firstId;
                    }
                    return prev;
                });
            }
        } catch (e: any) {
            console.error('[TeamsContext] Failed to fetch teams:', e);
            if (retryCount < 30) {
                setTimeout(() => fetchTeams(retryCount + 1), 1000);
            }
        }
    }, []);

    const createTeam = useCallback(async () => {
        if (!newTeamName) return;
        await fetch('http://127.0.0.1:3002/teams', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newTeamName }),
        });
        setNewTeamName('');
        fetchTeams();
    }, [newTeamName, fetchTeams]);

    const deleteTeam = useCallback(async (id: string) => {
        console.log(`[TeamsContext] 🗑️ Deleting team ${id}...`);
        setTeams(prev => prev.filter(t => t.id !== id));
        if (selectedTeam === id) setSelectedTeam(null);
        try {
            const res = await fetch(`http://127.0.0.1:3002/teams/${id}`, { method: 'DELETE' });
            const data = await res.json();
            console.log('[TeamsContext] Team delete response:', data);
        } catch (err) {
            console.error('[TeamsContext] Delete team error:', err);
        }
    }, [selectedTeam, setSelectedTeam]);

    return {
        teams,
        selectedTeam,
        setSelectedTeam,
        newTeamName,
        setNewTeamName,
        fetchTeams,
        createTeam,
        deleteTeam,
    };
};
