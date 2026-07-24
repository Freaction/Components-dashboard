import { useState, useCallback } from 'react';
import { File } from '../../components/types';
import { extractFileKey, extractFileName } from '../../../utils/figmaUtils';

export const useTeamFiles = (selectedTeam: string | null) => {
    const [files, setFiles] = useState<File[]>([]);
    const [newFileKey, setNewFileKey] = useState('');

    const fetchTeamDetails = useCallback(async () => {
        if (!selectedTeam) {
            setFiles([]);
            return;
        }
        try {
            const res = await fetch(`http://127.0.0.1:3002/teams/${selectedTeam}/files`);
            const data = await res.json();
            setFiles(data.files || []);
        } catch (e: any) {
            console.error('[TeamsContext] Failed to fetch team details:', e);
        }
    }, [selectedTeam]);

    const addFile = useCallback(async () => {
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
    }, [newFileKey, selectedTeam, fetchTeamDetails]);

    const deleteFile = useCallback(async (fileId: number) => {
        if (!selectedTeam) return;
        console.log(`[TeamsContext] 🗑️ Deleting file ${fileId} from team ${selectedTeam}...`);
        setFiles(prev => prev.filter(f => f.id !== fileId));
        try {
            const res = await fetch(`http://127.0.0.1:3002/teams/${selectedTeam}/files/${fileId}`, { method: 'DELETE' });
            const data = await res.json();
            console.log('[TeamsContext] File delete response:', data);
        } catch (err) {
            console.error('[TeamsContext] Delete file error:', err);
        }
    }, [selectedTeam]);

    const toggleReference = useCallback(async (fileId: number, current: boolean) => {
        if (!selectedTeam) return;
        await fetch(`http://127.0.0.1:3002/teams/${selectedTeam}/files/${fileId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_reference: !current }),
        });
        fetchTeamDetails();
    }, [selectedTeam, fetchTeamDetails]);

    return {
        files,
        newFileKey,
        setNewFileKey,
        fetchTeamDetails,
        addFile,
        deleteFile,
        toggleReference,
    };
};
