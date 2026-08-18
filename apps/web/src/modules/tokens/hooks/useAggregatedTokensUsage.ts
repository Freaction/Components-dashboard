import { useEffect, useMemo, useState } from 'react';

const API = 'http://127.0.0.1:3002';

function normalizeUsageKey(key: string): string {
  const parts = key.split('/');
  if (parts.length === 2 && parts[0].startsWith('VariableID:')) {
    return parts[0].replace('VariableID:', '');
  }
  return key;
}

function mergeUsage(target: Record<string, number>, source: Record<string, number>) {
  for (const [key, count] of Object.entries(source)) {
    const norm = normalizeUsageKey(key);
    target[norm] = (target[norm] || 0) + Number(count);
  }
}

export function useAggregatedTokensUsage(teams: { id: string }[]) {
  const [usageData, setUsageData] = useState<Record<string, number>>({});
  const teamIdsKey = useMemo(() => teams.map(t => t.id).sort().join(','), [teams]);

  useEffect(() => {
    if (!teamIdsKey) {
      setUsageData({});
      return;
    }

    let cancelled = false;
    const teamIds = teamIdsKey.split(',');

    (async () => {
      try {
        const fileResults = await Promise.all(
          teamIds.map(id =>
            fetch(`${API}/teams/${id}/files`)
              .then(r => r.json())
              .then(d => ({
                teamId: id,
                files: (d.files || []) as { is_reference?: boolean }[],
              }))
              .catch(() => ({ teamId: id, files: [] as { is_reference?: boolean }[] }))
          )
        );

        const productTeamIds = fileResults
          .filter(({ files }) => !files.some(f => f.is_reference))
          .map(({ teamId }) => teamId);

        const usageMaps = await Promise.all(
          productTeamIds.map(id =>
            fetch(`${API}/search/tokens-usage?team_id=${id}`)
              .then(r => r.json())
              .then(d => (d.usage || {}) as Record<string, number>)
              .catch(() => ({} as Record<string, number>))
          )
        );

        if (cancelled) return;

        const merged: Record<string, number> = {};
        for (const usage of usageMaps) mergeUsage(merged, usage);
        setUsageData(merged);
      } catch (err) {
        console.error('Failed to fetch aggregated tokens usage:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [teamIdsKey]);

  return usageData;
}
