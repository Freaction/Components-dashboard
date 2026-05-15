import React from 'react';
import { useTeams } from '../TeamsContext';
import { Button, IconButton, Input, Flex, Text, ScrollArea } from '../../../components/ui';
import { Plus } from 'lucide-react';

export const TeamsSidebar: React.FC = () => {
  const { 
    teams, selectedTeam, setSelectedTeam, 
    newTeamName, setNewTeamName, createTeam, deleteTeam, onScanAll, isScanningAll 
  } = useTeams();

  return (
    <div className="sidebar" style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      overflow: 'hidden',
      padding: 'var(--space-4)',
      gap: 'var(--space-2)'
    }}>
      <Text variant="xs" weight="bold" color="tertiary" style={{ textTransform: 'uppercase', display: 'block', flexShrink: 0 }}>
        Teams
      </Text>
      
      <Flex gap={2} style={{ marginBottom: 'var(--space-2)', flexShrink: 0, width: '100%' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Input 
            placeholder="New Team..." 
            value={newTeamName} 
            onChange={(e) => setNewTeamName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createTeam()}
            fullWidth
          />
        </div>
        <IconButton onClick={createTeam} size="md" icon={<Plus size={16} strokeWidth={1.2} />} />
      </Flex>

      <Button 
        variant="success" 
        fullWidth 
        onClick={onScanAll}
        style={{ marginBottom: 'var(--space-2)', flexShrink: 0 }}
        disabled={isScanningAll}
      >
        {isScanningAll ? 'Scanning...' : 'Scan All'}
      </Button>
      
      <ScrollArea style={{ flex: 1, minHeight: 0 }}>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {teams.map(t => (
            <li 
              key={t.id} 
              className={selectedTeam === String(t.id) ? 'active' : ''} 
              onClick={() => setSelectedTeam(String(t.id))}
              style={{
                padding: 'var(--space-2) var(--space-3)',
                cursor: 'pointer',
                borderRadius: 'var(--radius-base)',
                fontSize: 'var(--text-sm)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 'var(--space-1)'
              }}
            >
              <Text variant="sm" weight="normal" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '8px' }}>
                {t.name}
              </Text>
              <button 
                className="del-btn" 
                onClick={(e) => { e.stopPropagation(); deleteTeam(String(t.id)); }} 
                title="Delete team"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </ScrollArea>
    </div>
  );
};


