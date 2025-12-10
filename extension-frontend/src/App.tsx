import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Auth } from './Auth';
import { Sidebar } from './Sidebar';
import { Session } from '@supabase/supabase-js';
import './App.css'; // Import our component styles

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="container">
      {!session ? <Auth /> : <Sidebar key={session.user.id} />}
    </div>
  );
}

export default App;