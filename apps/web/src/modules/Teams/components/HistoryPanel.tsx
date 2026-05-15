import React from 'react';
import { useTeams } from '../TeamsContext';
import { Button, IconButton, Input, Badge, Text, Flex, ScrollArea } from '../../../components/ui';
import { Plus, Bookmark } from 'lucide-react';
import { formatDisplayName } from '../../../utils/figmaUtils';

export const HistoryPanel: React.FC = () => {
  const {
    selectedTeam, sessions, selectedSession, setSelectedSession,
    files, newFileKey, setNewFileKey, addFile, deleteFile,
    toggleReference, startScan, resumeSession, deleteSession
  } = useTeams();

  if (!selectedTeam) {
    return (
      <div className="history-panel" style={{ padding: 'var(--space-4)' }}>
        <div className="empty-state">Select a team to view history</div>
      </div>
    );
  }

  return (
    <div className="history-panel" style={{ 
      overflow: 'hidden', 
      padding: 'var(--space-4) 0 var(--space-4) var(--space-4)', // Right padding is 0
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-2)'
    }}>
      <div style={{ paddingRight: 'var(--space-4)' }}>
        <Text variant="xs" weight="bold" color="tertiary" style={{ textTransform: 'uppercase', display: 'block', flexShrink: 0 }}>
          Scan History
        </Text>
        
        <Button 
          variant="success" 
          fullWidth 
          onClick={startScan}
          style={{ marginBottom: 'var(--space-2)', marginTop: 'var(--space-2)', flexShrink: 0 }}
        >
          Start Scan
        </Button>
      </div>

      <ScrollArea style={{ flex: 1, minHeight: 0 }}>
        <div className="session-list" style={{ marginTop: 0, paddingRight: 'var(--space-4)' }}>
          {sessions.map(s => (
            <div 
              key={s.id} 
              className={`session-card ${selectedSession === s.id ? 'active' : ''}`}
              onClick={() => setSelectedSession(s.id)}
              style={{ padding: 'var(--space-2) var(--space-3)' }}
            >
              <Flex direction="column" gap={1}>
                <Text variant="sm" weight="medium">{new Date(s.created_at).toLocaleString()}</Text>
                <Flex align="center" gap={2}>
                  <Text variant="xs" color="secondary">
                    {s.nodes_count !== undefined ? `${s.nodes_count.toLocaleString()} nodes` : 'Calculating...'}
                  </Text>
                  <Badge variant={
                    s.status === 'completed' ? 'success' : 
                    s.status === 'proceed' ? 'violet' : 
                    s.status === 'processing' ? 'warning' : 
                    'slate'
                  }>
                    {s.status}
                  </Badge>
                  {s.status === 'failed' && (
                    <Button 
                      variant="slate" 
                      size="sm" 
                      onClick={(e) => { e.stopPropagation(); resumeSession(s.id); }}
                      style={{ height: '20px', padding: '0 var(--space-2)', fontSize: '10px' }}
                    >
                      Resume
                    </Button>
                  )}
                </Flex>
              </Flex>
              <button className="del-btn" onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}>×</button>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div style={{ borderTop: '1px solid var(--color-border-muted)', margin: 'var(--space-2) 0', flexShrink: 0 }} />
      
      <div style={{ paddingRight: 'var(--space-4)' }}>
        <Text variant="xs" weight="bold" color="tertiary" style={{ textTransform: 'uppercase', display: 'block', flexShrink: 0 }}>
          Files
        </Text>

        <Flex gap={2} style={{ marginBottom: 'var(--space-2)', marginTop: 'var(--space-2)', flexShrink: 0, width: '100%' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Input 
              value={newFileKey} 
              onChange={e => setNewFileKey(e.target.value)} 
              placeholder="Figma URL/Key" 
              fullWidth
              onKeyDown={(e) => e.key === 'Enter' && addFile()}
            />
          </div>
          <IconButton onClick={addFile} size="md" icon={<Plus size={16} strokeWidth={1.2} />} />
        </Flex>
      </div>

      <ScrollArea style={{ flex: 1, minHeight: 0 }}>
        <ul className="file-list" style={{ padding: 0, margin: 0, listStyle: 'none', paddingRight: 'var(--space-4)' }}>
          {files.map(f => (
            <li key={f.id} title={f.file_key} style={{ display: 'flex', alignItems: 'center', padding: 'var(--space-1) var(--space-3)' }}>
              <IconButton 
                size="sm" 
                onClick={() => toggleReference(f.id, !!f.is_reference)}
                icon={<Bookmark size={12} fill={f.is_reference ? 'var(--color-text-accent)' : 'none'} />} 
                style={{ 
                  marginRight: '8px', 
                  color: f.is_reference ? 'var(--color-text-accent)' : 'var(--color-text-tertiary)',
                  padding: 0,
                  width: '20px',
                  height: '20px'
                }} 
                title={f.is_reference ? "Design System (Reference)" : "Mark as Reference"}
              />
              <Text variant="xs" weight="medium" style={{ 
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                whiteSpace: 'nowrap', 
                marginRight: '8px',
                flex: 1,
                color: f.is_reference ? 'var(--color-text-accent)' : 'inherit'
              }}>
                {formatDisplayName(f.file_name || 'Unnamed')}
              </Text>
              <button className="del-btn" onClick={() => deleteFile(f.id)} title="Remove file">×</button>
            </li>
          ))}
        </ul>
      </ScrollArea>
    </div>
  );
};
