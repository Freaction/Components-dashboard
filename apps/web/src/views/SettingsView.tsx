import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Flex, Text } from '../components/ui';

export const SettingsView: React.FC = () => {
  const [token, setToken] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('http://localhost:3001/settings');
      const data = await res.json();
      if (data.FIGMA_TOKEN) {
        setToken(data.FIGMA_TOKEN);
      }
    } catch (e) {
      console.error('Failed to fetch settings');
    }
  };

  const saveToken = async () => {
    setStatus('Saving...');
    try {
      const res = await fetch('http://localhost:3001/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'FIGMA_TOKEN', value: token.trim() }),
      });
      if (res.ok) {
        setStatus('✅ Token saved successfully!');
        setTimeout(() => setStatus(''), 3000);
      } else {
        setStatus('❌ Failed to save token');
      }
    } catch (e) {
      setStatus('❌ Error connecting to API');
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <Card title="General Settings">
        <Text variant="sm" color="secondary" style={{ display: 'block', marginBottom: 'var(--space-6)' }}>
          Configure your Figma integration here. The token is stored locally in your database.
        </Text>

        <div style={{ maxWidth: '500px' }}>
          <Flex align="flex-end" gap={3}>
            <div style={{ flex: 1 }}>
              <Input
                label="Figma Personal Access Token"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="fig_..."
                fullWidth
              />
            </div>
            <Button onClick={saveToken} style={{ marginBottom: '2px' }}>
              Save Token
            </Button>
          </Flex>
          
          {status && (
            <div style={{ marginTop: 'var(--space-3)' }}>
              <Text 
                variant="sm" 
                weight="medium" 
                color={status.includes('✅') ? 'success' : 'error'}
              >
                {status}
              </Text>
            </div>
          )}
        </div>

        <section style={{ marginTop: 'var(--space-8)', paddingTop: 'var(--space-6)', borderTop: '1px solid var(--color-border-base)' }}>
          <Text variant="sm" weight="bold" style={{ display: 'block', marginBottom: 'var(--space-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Instructions
          </Text>
          <ol style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', lineHeight: '1.6', paddingLeft: 'var(--space-5)' }}>
            <li>Go to Figma Settings &gt; Account</li>
            <li>Find "Personal access tokens" and generate a new one.</li>
            <li>Copy the token (it starts with <code>fig_</code>) and paste it above.</li>
            <li>Make sure you selected <code>file_read</code> scope.</li>
          </ol>
        </section>
      </Card>
    </div>
  );
};


