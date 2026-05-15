import React from 'react';
import { useTeams } from './TeamsContext';
import { TeamsSidebar } from './components/TeamsSidebar';
import { HistoryPanel } from './components/HistoryPanel';
import { ExplorerPanel } from './components/ExplorerPanel';

import styles from './TeamsView.module.css';

export const TeamsView: React.FC = () => {
  const {
    teams, selectedTeam, setSelectedTeam,
    newTeamName, setNewTeamName, createTeam, deleteTeam, scanAll, isScanningAll,
    sessions, selectedSession, setSelectedSession,
    files, newFileKey, setNewFileKey, addFile, deleteFile, toggleReference,
    startScan, resumeSession, deleteSession,
    rootNodes, isLoadingRoots, selectedNode, setSelectedNode,
    typeFilter, setTypeFilter, deleteFileNodes
  } = useTeams();

  return (
    <div className={styles.container}>
      <TeamsSidebar
        teams={teams}
        selectedTeam={selectedTeam}
        onSelectTeam={setSelectedTeam}
        newTeamName={newTeamName}
        setNewTeamName={setNewTeamName}
        onCreateTeam={createTeam}
        onDeleteTeam={deleteTeam}
        onScanAll={scanAll}
        isScanningAll={isScanningAll}
      />

      <div className={styles.workspaceWrapper}>
        <div className={styles.workspace}>
          <HistoryPanel
            selectedTeam={selectedTeam}
            sessions={sessions}
            selectedSession={selectedSession}
            onSelectSession={setSelectedSession}
            files={files}
            newFileKey={newFileKey}
            setNewFileKey={setNewFileKey}
            onAddFile={addFile}
            onDeleteFile={deleteFile}
            onToggleReference={toggleReference}
            onStartScan={startScan}
            onResumeSession={resumeSession}
            onDeleteSession={deleteSession}
          />
          <ExplorerPanel
            selectedTeam={selectedTeam}
            selectedSession={selectedSession}
            rootNodes={rootNodes}
            isLoadingRoots={isLoadingRoots}
            selectedNode={selectedNode}
            onSelectNode={setSelectedNode}
            defaultFileKey={files[0]?.file_key}
            defaultFileName={files[0]?.file_name}
            typeFilter={typeFilter}
            setTypeFilter={setTypeFilter}
            onDeleteFileNodes={deleteFileNodes}
          />
        </div>
      </div>
    </div>
  );
};
