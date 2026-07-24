import { useState, useCallback } from 'react';
import { Session } from '../../components/types';

export const useTeamSessions = (selectedTeam: string | null) => {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [selectedSession, setSelectedSession] = useState<string | null>(null);
    const [isScanningAll, setIsScanningAll] = useState(false);

    const fetchSessions = useCallback(async () => {
        if (!selectedTeam) {
            setSessions([]);
            return;
        }
        try {
            const res = await fetch(`http://127.0.0.1:3002/teams/${selectedTeam}/sessions`);
            const data = await res.json();
            setSessions(data.sessions || []);
        } catch (e: any) {
            console.error('[TeamsContext] Failed to fetch sessions:', e);
        }
    }, [selectedTeam]);

    const startScan = useCallback(async () => {
        if (!selectedTeam) return;
        try {
            await fetch(`http://127.0.0.1:3002/teams/${selectedTeam}/scan`, { method: 'POST' });
            fetchSessions();
        } catch (e) {
            console.error('Failed to start scan:', e);
        }
    }, [selectedTeam, fetchSessions]);

    const resumeSession = useCallback(async (sid: string) => {
        if (!selectedTeam) return;
        try {
            setSessions(prev => prev.map(s => s.id === sid ? { ...s, status: 'pending' } : s));
            await fetch(`http://127.0.0.1:3002/teams/${selectedTeam}/sessions/${sid}/resume`, { method: 'POST' });
            fetchSessions();
        } catch (e) {
            console.error('Failed to resume session:', e);
            fetchSessions();
        }
    }, [selectedTeam, fetchSessions]);

    const pauseSession = useCallback(async (sid: string) => {
        if (!selectedTeam) return;
        try {
            await fetch(`http://127.0.0.1:3002/teams/${selectedTeam}/sessions/${sid}/pause`, { method: 'POST' });
            fetchSessions();
        } catch (e) {
            console.error('Failed to pause session:', e);
        }
    }, [selectedTeam, fetchSessions]);

    const deleteSession = useCallback(async (sid: string) => {
        if (!selectedTeam) return;
        console.log(`[TeamsContext] 🗑️ Deleting session ${sid} from team ${selectedTeam}...`);
        setSessions(prev => prev.filter(s => s.id !== sid));
        if (selectedSession === sid) setSelectedSession(null);
        try {
            const res = await fetch(`http://127.0.0.1:3002/teams/${selectedTeam}/sessions/${sid}`, { method: 'DELETE' });
            const data = await res.json();
            console.log('[TeamsContext] Session delete response:', data);
        } catch (err) {
            console.error('[TeamsContext] Delete session error:', err);
        }
    }, [selectedTeam, selectedSession]);

    const scanAll = useCallback(async () => {
        setIsScanningAll(true);
        try {
            await fetch('http://127.0.0.1:3002/teams/scan-all', { method: 'POST' });
            fetchSessions();
        } catch (e) {
            console.error(e);
        } finally {
            setIsScanningAll(false);
        }
    }, [fetchSessions]);

    return {
        sessions,
        setSessions,
        selectedSession,
        setSelectedSession,
        isScanningAll,
        fetchSessions,
        startScan,
        resumeSession,
        pauseSession,
        deleteSession,
        scanAll,
    };
};
