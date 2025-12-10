// src/Sidebar.tsx
import { useState } from 'react';
import { supabase } from './supabaseClient';
import './Sidebar.css';
import { ChatView } from './ChatView';
import { ComposeView } from './ComposeView';
import { SettingsView } from './SettingsView';
import { EventsView } from './EventsView'; // 1. Import the Events view

// 2. Extend the View type
type View = 'chat' | 'compose' | 'events' | 'settings';

export function Sidebar() {
  const [activeView, setActiveView] = useState<View>('chat');

  return (
    <div className="container">
      <div className="header">
        <h3>Omni AI</h3>
        <div className="header-controls">
          {/* Optional: theme toggle button can go here */}
          <button
            onClick={() => supabase.auth.signOut()}
            className="logout-button"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="view-tabs">
        <button
          className={`tab-button ${activeView === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveView('chat')}
        >
          Chat
        </button>
        <button
          className={`tab-button ${activeView === 'compose' ? 'active' : ''}`}
          onClick={() => setActiveView('compose')}
        >
          Compose
        </button>
        {/* 3. Add Events tab */}
        <button
          className={`tab-button ${activeView === 'events' ? 'active' : ''}`}
          onClick={() => setActiveView('events')}
        >
          Events
        </button>
        <button
          className={`tab-button ${activeView === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveView('settings')}
        >
          Settings
        </button>
      </div>

      <div className="view-content">
        {activeView === 'chat' && <ChatView />}
        {activeView === 'compose' && <ComposeView />}
        {activeView === 'events' && <EventsView />} {/* 4. Render EventsView */}
        {activeView === 'settings' && <SettingsView />}
      </div>
    </div>
  );
}
