import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Team, Session, File, Node } from './components/types';
import { extractFileKey, extractFileName } from '../../utils/figmaUtils';
import { getNodesQueryString } from '../../utils/searchUtils';

interface TeamsContextType {
  teams: Team[];
  selectedTeam: string | null;
  setSelectedTeam: (id: string | null) => void;
  files: File[];
  sessions: Session[];
  selectedSession: string | null;
  setSelectedSession: (id: string | null) => void;
  selectedNode: Node | null;
  setSelectedNode: (n: Node | null) => void;
  rootNodes: Node[];
  isLoadingRoots: boolean;
  newTeamName: string;
  setNewTeamName: (name: string) => void;
  newFileKey: string;
  setNewFileKey: (key: string) => void;
  isScanningAll: boolean;
  typeFilter: string[];
  setTypeFilter: (t: string[]) => void;
  
  // Actions
  fetchTeams: () => Promise<void>;
  createTeam: () => Promise<void>;
  deleteTeam: (id: string) => Promise<void>;
  addFile: () => Promise<void>;
  deleteFile: (id: number) => Promise<void>;
  toggleReference: (id: number, current: boolean) => Promise<void>;
  startScan: () => Promise<void>;
  resumeSession: (sid: string) => Promise<void>;
  pauseSession: (sid: string) => Promise<void>;
  deleteSession: (sid: string) => Promise<void>;
  scanAll: () => Promise<void>;
  deleteFileNodes: (fileKey: string) => Promise<void>;
}

const TeamsContext = createContext<TeamsContextType | undefined>(undefined);

export const TeamsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeamState] = useState<string | null>(() => {
    return localStorage.getItem('selected_team_id');
  });

  const setSelectedTeam = (id: string | null) => {
    setSelectedTeamState(id);
    if (id) {
      localStorage.setItem('selected_team_id', id);
    } else {
      localStorage.removeItem('selected_team_id');
    }
  };

  const [files, setFiles] = useState<File[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [rootNodes, setRootNodes] = useState<Node[]>([]);
  const [isLoadingRoots, setIsLoadingRoots] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newFileKey, setNewFileKey] = useState('');
  const [isScanningAll, setIsScanningAll] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);

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

  const fetchTeamDetails = useCallback(async () => {
    if (!selectedTeam) return;
    try {
      const res = await fetch(`http://127.0.0.1:3002/teams/${selectedTeam}/files`);
      const data = await res.json();
      setFiles(data.files || []);
    } catch (e: any) {
      console.error('[TeamsContext] Failed to fetch team details:', e);
    }
  }, [selectedTeam]);

  const fetchSessions = useCallback(async () => {
    if (!selectedTeam) return;
    try {
      const res = await fetch(`http://127.0.0.1:3002/teams/${selectedTeam}/sessions`);
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (e: any) {
      console.error('[TeamsContext] Failed to fetch sessions:', e);
    }
  }, [selectedTeam]);

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

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  useEffect(() => {
    if (selectedTeam) {
      fetchTeamDetails();
      fetchSessions();
      setSelectedSession(null);
      setSelectedNode(null);
    }
  }, [selectedTeam, fetchTeamDetails, fetchSessions]);

  useEffect(() => {
    if (selectedSession) {
      fetchRootNodes(selectedSession, typeFilter);
      setSelectedNode(null);
    } else {
      setRootNodes([]);
    }
  }, [selectedSession, typeFilter, fetchRootNodes]);

  const hasActiveScan = sessions.some(s => s.status === 'processing' || s.status === 'pending');

  useEffect(() => {
    if (!selectedTeam || !hasActiveScan) return;

    let tick = 0;
    const interval = setInterval(() => {
      fetch(`http://127.0.0.1:3002/teams/${selectedTeam}/sessions`)
        .then(res => res.json())
        .then(data => setSessions(data.sessions || []))
        .catch(console.error);
        
      tick++;
      if (tick % 4 === 0) {
        // Refresh files every 2 seconds during scan to see renamed/deleted files
        fetchTeamDetails();
      }
    }, 500);

    return () => clearInterval(interval);
  }, [selectedTeam, hasActiveScan, fetchTeamDetails]);

  const createTeam = async () => {
    if (!newTeamName) return;
    await fetch('http://127.0.0.1:3002/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newTeamName }),
    });
    setNewTeamName('');
    fetchTeams();
  };

  const deleteTeam = (id: string) => {
    console.log(`[TeamsContext] 🗑️ Deleting team ${id}...`);
    setTeams(prev => prev.filter(t => t.id !== id));
    if (selectedTeam === id) setSelectedTeam(null);
    fetch(`http://127.0.0.1:3002/teams/${id}`, { method: 'DELETE' })
      .then(res => res.json())
      .then(data => console.log('[TeamsContext] Team delete response:', data))
      .catch(err => console.error('[TeamsContext] Delete team error:', err));
  };

  const addFile = async () => {
    if (!newFileKey || !selectedTeam) return;
    const fileKey = extractFileKey(newFileKey);
    const fileName = extractFileName(newFileKey) || 'Manual Link';
    await fetch(`http://127.0.0.1:3002/teams/${selectedTeam}/files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_key: fileKey, file_name: fileName }),
    });
    setNewFileKey('');
    fetchTeamDetails();
  };

  const deleteFile = (fileId: number) => {
    if (!selectedTeam) return;
    console.log(`[TeamsContext] 🗑️ Deleting file ${fileId} from team ${selectedTeam}...`);
    setFiles(prev => prev.filter(f => f.id !== fileId));
    fetch(`http://127.0.0.1:3002/teams/${selectedTeam}/files/${fileId}`, { method: 'DELETE' })
      .then(res => res.json())
      .then(data => console.log('[TeamsContext] File delete response:', data))
      .catch(err => console.error('[TeamsContext] Delete file error:', err));
  };

  const toggleReference = async (fileId: number, current: boolean) => {
    if (!selectedTeam) return;
    await fetch(`http://127.0.0.1:3002/teams/${selectedTeam}/files/${fileId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_reference: !current }),
    });
    fetchTeamDetails();
  };

  const startScan = async () => {
    if (!selectedTeam) return;
    try {
      await fetch(`http://127.0.0.1:3002/teams/${selectedTeam}/scan`, { method: 'POST' });
      fetchSessions();
    } catch (e) {
      console.error('Failed to start scan:', e);
    }
  };

  const resumeSession = async (sid: string) => {
    if (!selectedTeam) return;
    try {
      setSessions(prev => prev.map(s => s.id === sid ? { ...s, status: 'pending' } : s));
      await fetch(`http://127.0.0.1:3002/teams/${selectedTeam}/sessions/${sid}/resume`, { method: 'POST' });
      fetchSessions(); 
    } catch (e) {
      console.error('Failed to resume session:', e);
      fetchSessions();
    }
  };

  const pauseSession = async (sid: string) => {
    if (!selectedTeam) return;
    try {
      await fetch(`http://127.0.0.1:3002/teams/${selectedTeam}/sessions/${sid}/pause`, { method: 'POST' });
      fetchSessions();
    } catch (e) {
      console.error('Failed to pause session:', e);
    }
  };

  const deleteSession = (sid: string) => {
    console.log(`[TeamsContext] 🗑️ Deleting session ${sid} from team ${selectedTeam}...`);
    setSessions(prev => prev.filter(s => s.id !== sid));
    if (selectedSession === sid) setSelectedSession(null);
    fetch(`http://127.0.0.1:3002/teams/${selectedTeam}/sessions/${sid}`, { method: 'DELETE' })
      .then(res => res.json())
      .then(data => console.log('[TeamsContext] Session delete response:', data))
      .catch(err => console.error('[TeamsContext] Delete session error:', err));
  };

  const scanAll = async () => {
    setIsScanningAll(true);
    try {
      await fetch('http://127.0.0.1:3002/teams/scan-all', { method: 'POST' });
      fetchSessions();
    } catch (e) {
      console.error(e);
    } finally {
      setIsScanningAll(false);
    }
  };

  const deleteFileNodes = async (fileKey: string) => {
    if (!selectedSession) return;
    try {
      await fetch(`http://127.0.0.1:3002/nodes/session/${selectedSession}/file/${fileKey}`, { method: 'DELETE' });
      fetchRootNodes(selectedSession, typeFilter);
    } catch (e) {
      console.error('Failed to delete file nodes:', e);
    }
  };

  const value = {
    teams, selectedTeam, setSelectedTeam,
    files, sessions, selectedSession, setSelectedSession,
    selectedNode, setSelectedNode, rootNodes, isLoadingRoots,
    newTeamName, setNewTeamName, newFileKey, setNewFileKey,
    isScanningAll, typeFilter, setTypeFilter,
    fetchTeams, createTeam, deleteTeam, addFile, deleteFile,
    toggleReference, startScan, resumeSession, pauseSession, deleteSession,
    scanAll, deleteFileNodes
  };

  return <TeamsContext.Provider value={value}>{children}</TeamsContext.Provider>;
};

export const useTeams = () => {
  const context = useContext(TeamsContext);
  if (context === undefined) {
    throw new Error('useTeams must be used within a TeamsProvider');
  }
  return context;
};
