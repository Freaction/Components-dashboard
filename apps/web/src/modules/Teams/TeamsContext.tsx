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
  deleteSession: (sid: string) => Promise<void>;
  scanAll: () => Promise<void>;
  deleteFileNodes: (fileKey: string) => Promise<void>;
}

const TeamsContext = createContext<TeamsContextType | undefined>(undefined);

export const TeamsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
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

  const fetchTeams = useCallback(async () => {
    console.log('[TeamsContext] Fetching teams...');
    try {
      const start = Date.now();
      const res = await fetch('http://127.0.0.1:3001/teams');
      const data = await res.json();
      console.log(`[TeamsContext] Teams received in ${Date.now() - start}ms:`, data.teams?.length);
      setTeams(data.teams);
    } catch (e) {
      console.error('[TeamsContext] Failed to fetch teams:', e);
    }
  }, []);

  const fetchTeamDetails = useCallback(async () => {
    if (!selectedTeam) return;
    const res = await fetch(`http://127.0.0.1:3001/teams/${selectedTeam}`);
    const data = await res.json();
    setFiles(data.files || []);
  }, [selectedTeam]);

  const fetchSessions = useCallback(async () => {
    if (!selectedTeam) return;
    const res = await fetch(`http://127.0.0.1:3001/teams/${selectedTeam}/sessions`);
    const data = await res.json();
    setSessions(data.sessions || []);
  }, [selectedTeam]);

  const fetchRootNodes = useCallback(async (sid: string, types: string[] = []) => {
    console.log(`[TeamsContext] Fetching root nodes for session ${sid}...`);
    setIsLoadingRoots(true);
    try {
      const start = Date.now();
      const queryString = getNodesQueryString(sid, types);
      const res = await fetch(`http://127.0.0.1:3001/nodes?${queryString}`);
      const data = await res.json();
      console.log(`[TeamsContext] Root nodes received in ${Date.now() - start}ms:`, data.nodes?.length);
      setRootNodes(data.nodes || []);
    } catch (e) {
      console.error('[TeamsContext] Failed to fetch root nodes:', e);
    }
    setIsLoadingRoots(false);
  }, []);

  useEffect(() => { fetchTeams(); }, [fetchTeams]);

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

    const interval = setInterval(() => {
      fetch(`http://127.0.0.1:3001/teams/${selectedTeam}/sessions`)
        .then(res => res.json())
        .then(data => setSessions(data.sessions || []))
        .catch(console.error);
    }, 1500);

    return () => clearInterval(interval);
  }, [selectedTeam, hasActiveScan]);

  const createTeam = async () => {
    if (!newTeamName) return;
    await fetch('http://127.0.0.1:3001/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newTeamName }),
    });
    setNewTeamName('');
    fetchTeams();
  };

  const deleteTeam = async (id: string) => {
    await fetch(`http://127.0.0.1:3001/teams/${id}`, { method: 'DELETE' });
    if (selectedTeam === id) setSelectedTeam(null);
    fetchTeams();
  };

  const addFile = async () => {
    if (!newFileKey || !selectedTeam) return;
    const fileKey = extractFileKey(newFileKey);
    const fileName = extractFileName(newFileKey) || 'Manual Link';
    await fetch(`http://127.0.0.1:3001/teams/${selectedTeam}/files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_key: fileKey, file_name: fileName }),
    });
    setNewFileKey('');
    fetchTeamDetails();
  };

  const deleteFile = async (fileId: number) => {
    if (!selectedTeam) return;
    await fetch(`http://127.0.0.1:3001/teams/${selectedTeam}/files/${fileId}`, { method: 'DELETE' });
    fetchTeamDetails();
  };

  const toggleReference = async (fileId: number, current: boolean) => {
    if (!selectedTeam) return;
    await fetch(`http://127.0.0.1:3001/teams/${selectedTeam}/files/${fileId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_reference: !current }),
    });
    fetchTeamDetails();
  };

  const startScan = async () => {
    if (!selectedTeam) return;
    await fetch(`http://127.0.0.1:3001/teams/${selectedTeam}/scan`, { method: 'POST' });
    fetchSessions();
  };

  const resumeSession = async (sid: string) => {
    if (!selectedTeam) return;
    await fetch(`http://127.0.0.1:3001/teams/${selectedTeam}/sessions/${sid}/resume`, { method: 'POST' });
    fetchSessions();
  };

  const deleteSession = async (sid: string) => {
    await fetch(`http://127.0.0.1:3001/teams/${selectedTeam}/sessions/${sid}`, { method: 'DELETE' });
    if (selectedSession === sid) setSelectedSession(null);
    fetchSessions();
  };

  const scanAll = async () => {
    setIsScanningAll(true);
    try {
      await fetch('http://127.0.0.1:3001/teams/scan-all', { method: 'POST' });
      fetchSessions();
    } catch (e) {
      console.error(e);
    } finally {
      setIsScanningAll(false);
    }
  };

  const deleteFileNodes = async (fileKey: string) => {
    if (!selectedSession) return;
    await fetch(`http://127.0.0.1:3001/nodes/session/${selectedSession}/file/${fileKey}`, { method: 'DELETE' });
    fetchRootNodes(selectedSession, typeFilter);
  };

  const value = {
    teams, selectedTeam, setSelectedTeam,
    files, sessions, selectedSession, setSelectedSession,
    selectedNode, setSelectedNode, rootNodes, isLoadingRoots,
    newTeamName, setNewTeamName, newFileKey, setNewFileKey,
    isScanningAll, typeFilter, setTypeFilter,
    fetchTeams, createTeam, deleteTeam, addFile, deleteFile,
    toggleReference, startScan, resumeSession, deleteSession,
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
