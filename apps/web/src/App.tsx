import React, { useState } from 'react';
import { SettingsView } from './views/SettingsView';
import { TeamsView, TeamsProvider } from './modules/Teams/index.tsx';
import { SearchView } from './modules/Search';
import { DSKitStatsView } from './views/DSKitStatsView';
import { TokensDashboard } from './modules/tokens/index';

function App() {
  const [tab, setTab] = useState<'teams' | 'search' | 'settings' | 'ds-stats' | 'tokens'>('teams');

  return (
    <TeamsProvider>
      <div className="container">
        <header style={{ marginBottom: 'var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)', margin: 0 }}>
            Components Dashboard
          </h1>
          <nav className="tabs">
            <button 
              onClick={() => setTab('teams')} 
              className={tab === 'teams' ? 'active' : ''}
            >
              Commands
            </button>

            <button 
              onClick={() => setTab('search')} 
              className={tab === 'search' ? 'active' : ''}
            >
              Analytics
            </button>

            <button 
              onClick={() => setTab('ds-stats')} 
              className={tab === 'ds-stats' ? 'active' : ''}
            >
              DS Kit Stats
            </button>

            <button 
              onClick={() => setTab('tokens')} 
              className={tab === 'tokens' ? 'active' : ''}
            >
              Tokens Analysis
            </button>

            <button 
              onClick={() => setTab('settings')} 
              className={tab === 'settings' ? 'active' : ''}
            >
              Settings
            </button>
          </nav>
        </header>

        <main>
          {tab === 'teams' && <TeamsView />}
          {tab === 'search' && <SearchView />}
          {tab === 'ds-stats' && <DSKitStatsView />}
          {tab === 'tokens' && <TokensDashboard />}
          {tab === 'settings' && <SettingsView />}
        </main>
      </div>
    </TeamsProvider>
  );
}

export default App;

