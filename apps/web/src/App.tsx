import React, { useState } from 'react';
import { SettingsView } from './views/SettingsView';
import { TeamsView } from './modules/Teams/index.tsx';
import { SearchView } from './modules/Search';

function App() {
  const [tab, setTab] = useState<'teams' | 'search' | 'settings'>('teams');

  return (
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
        {tab === 'settings' && <SettingsView />}
      </main>
    </div>
  );
}

export default App;


