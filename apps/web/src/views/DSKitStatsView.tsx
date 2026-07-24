import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTeams } from '../modules/Teams/TeamsContext';
import { generateWebLink } from '../utils/figmaUtils';

export function DSKitStatsView() {
  const { selectedTeam } = useTeams();
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedTeam) {
      fetchStats();
    }
  }, [selectedTeam]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`http://127.0.0.1:3002/search/ds-usage?team_id=${selectedTeam}`);
      setStats(res.data.stats || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch DS Kit usage stats');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>Loading DS Kit Statistics...</div>;
  }

  if (error) {
    return <div className="card" style={{ padding: 'var(--space-6)', color: 'var(--color-danger)' }}>{error}</div>;
  }

  return (
    <div className="card" style={{ padding: 'var(--space-6)' }}>
      <h2 style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--text-lg)' }}>Design System Component Usage</h2>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-6)' }}>
        This ranks components from your designated Reference UI Kit based on how many times they are used across all other files.
      </p>

      {stats.length === 0 ? (
        <div style={{ padding: 'var(--space-4)', backgroundColor: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)' }}>
          No reference components found. Make sure you have at least one file marked as "Reference" and other files that use its components.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {stats.map((s, idx) => (
            <div key={idx} style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              padding: 'var(--space-3) var(--space-4)', 
              backgroundColor: 'var(--color-bg-secondary)', 
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-subtle, rgba(255,255,255,0.05))',
              transition: 'transform 0.15s ease, border-color 0.15s ease'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <span style={{ 
                  color: idx < 3 ? 'var(--color-primary, #3b82f6)' : 'var(--color-text-tertiary, #64748b)', 
                  fontWeight: idx < 3 ? 'bold' : 'normal',
                  width: '32px',
                  fontSize: 'var(--text-sm)'
                }}>
                  #{idx + 1}
                </span>
                {s.file_key ? (
                  <a 
                    href={generateWebLink({ fileKey: s.file_key, fileName: s.file_name, nodeId: s.node_id })}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ 
                      fontWeight: '600', 
                      color: 'var(--color-text-primary, #f8fafc)',
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#3b82f6')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-primary, #f8fafc)')}
                  >
                    {s.name} ↗
                  </a>
                ) : (
                  <span style={{ fontWeight: '600', color: 'var(--color-text-primary, #f8fafc)' }}>{s.name}</span>
                )}
                <span style={{ 
                  fontSize: '11px', 
                  color: 'var(--color-text-secondary, #94a3b8)', 
                  padding: '2px 8px', 
                  backgroundColor: 'rgba(255, 255, 255, 0.06)', 
                  borderRadius: '10px' 
                }}>
                  {s.file_name}
                </span>
              </div>
              <div style={{ 
                fontWeight: '600', 
                backgroundColor: '#2563eb', 
                color: '#ffffff', 
                padding: '4px 12px', 
                borderRadius: '16px',
                fontSize: '12px',
                letterSpacing: '0.3px',
                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)'
              }}>
                {Number(s.usage_count).toLocaleString()} <span style={{ fontSize: '11px', opacity: 0.9, fontWeight: 'normal' }}>instances</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
