import React, { createContext, useContext, useEffect } from 'react';
import { Team, Session, File, Node } from './components/types';
import { useTeamsList } from './hooks/useTeamsList';
import { useTeamFiles } from './hooks/useTeamFiles';
import { useTeamSessions } from './hooks/useTeamSessions';
import { useTeamNodes } from './hooks/useTeamNodes';

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
  const teamsList = useTeamsList();
  const teamFiles = useTeamFiles(teamsList.selectedTeam);
  const teamSessions = useTeamSessions(teamsList.selectedTeam);
  const teamNodes = useTeamNodes(teamSessions.selectedSession);

  useEffect(() => {
    teamsList.fetchTeams();
  }, [teamsList.fetchTeams]);

  useEffect(() => {
    if (teamsList.selectedTeam) {
      teamFiles.fetchTeamDetails();
      teamSessions.fetchSessions();
      teamSessions.setSelectedSession(null);
      teamNodes.setSelectedNode(null);
    }
  }, [teamsList.selectedTeam, teamFiles.fetchTeamDetails, teamSessions.fetchSessions]); // Using object destructuring above avoids exhaustive-deps warning for the hooks when kept stable

  useEffect(() => {
    if (teamSessions.selectedSession) {
      teamNodes.fetchRootNodes(teamSessions.selectedSession, teamNodes.typeFilter);
      teamNodes.setSelectedNode(null);
    } else {
      teamNodes.setRootNodes([]);
    }
  }, [teamSessions.selectedSession, teamNodes.typeFilter, teamNodes.fetchRootNodes]);

  const hasActiveScan = teamSessions.sessions.some(s => s.status === 'processing' || s.status === 'pending');

  useEffect(() => {
    if (!teamsList.selectedTeam || !hasActiveScan) return;

    let tick = 0;
    const interval = setInterval(() => {
      fetch(`http://127.0.0.1:3002/teams/${teamsList.selectedTeam}/sessions`)
        .then(res => res.json())
        .then(data => teamSessions.setSessions(data.sessions || []))
        .catch(console.error);

      tick++;
      if (tick % 4 === 0) {
        teamFiles.fetchTeamDetails();
      }
    }, 500);

    return () => clearInterval(interval);
  }, [teamsList.selectedTeam, hasActiveScan, teamFiles.fetchTeamDetails]);

  const value = {
    ...teamsList,
    ...teamFiles,
    ...teamSessions,
    ...teamNodes,
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
