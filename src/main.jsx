import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import './styles.css';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

function PocketCircleApp() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState([]);
  const [newGroupName, setNewGroupName] = useState('');

  useEffect(() => {
    // Get initial auth session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      fetchGroups();
    }
  }, [session]);

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const fetchGroups = async () => {
    const { data, error } = await supabase.from('groups').select('*');
    if (!error) setGroups(data || []);
  };

  const createGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    // Insert only the name into groups
    const { data: groupData, error: groupError } = await supabase
      .from('groups')
      .insert([{ name: newGroupName }])
      .select()
      .single();

    if (groupError) {
      console.error('Group creation failed:', groupError.message);
      alert(`Error creating group: ${groupError.message}`);
      return;
    }

    if (groupData) {
      setNewGroupName('');
      fetchGroups();
    }
  };

  const getInviteLink = (groupId) => {
    return `${window.location.origin}?invite=${groupId}`;
  };

  if (loading) {
    return <div style={{ padding: 20, textStyle: 'center' }}>Loading PocketCircle...</div>;
  }

  // 1. SIGN-IN SCREEN (When user is logged out)
  if (!session) {
    return (
      <div style={styles.card}>
        <h1>Welcome to PocketCircle ⭕</h1>
        <p>Private expense tracking for family and friends.</p>
        <button onClick={handleGoogleLogin} style={styles.googleBtn}>
          Sign in with Google
        </button>
      </div>
    );
  }

  // 2. MAIN DASHBOARD & INVITE SCREEN (When user is logged in)
  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h2>PocketCircle ⭕</h2>
        <button onClick={handleLogout} style={styles.logoutBtn}>Logout</button>
      </header>

      <h3>Create a Group</h3>
      <form onSubmit={createGroup} style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <input 
          type="text" 
          placeholder="Group Name (e.g., Home, Vacation)" 
          value={newGroupName} 
          onChange={(e) => setNewGroupName(e.target.value)}
          style={styles.input}
        />
        <button type="submit" style={styles.btn}>Create</button>
      </form>

      <h3>Your Groups & Invites</h3>
      {groups.length === 0 ? (
        <p>No groups yet. Create one above to invite family members!</p>
      ) : (
        groups.map(group => (
          <div key={group.id} style={styles.groupCard}>
            <h4>{group.name}</h4>
            <div style={{ marginTop: 10 }}>
              <p style={{ fontSize: 13, color: '#555' }}>Share link to invite members:</p>
              <input 
                type="text" 
                readOnly 
                value={getInviteLink(group.id)} 
                style={styles.input} 
                onClick={(e) => e.target.select()}
              />
              <a 
                href={`https://api.whatsapp.com/send?text=Join%20my%20group%20on%20PocketCircle:%20${encodeURIComponent(getInviteLink(group.id))}`}
                target="_blank"
                rel="noreferrer"
                style={styles.whatsappBtn}
              >
                Share on WhatsApp 📲
              </a>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

const styles = {
  container: { maxWidth: 600, margin: '0 auto', padding: 20, fontFamily: 'sans-serif' },
  card: { maxWidth: 400, margin: '100px auto', padding: 30, textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', borderRadius: 12, fontFamily: 'sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ccc', paddingBottom: 10 },
  googleBtn: { padding: '12px 24px', fontSize: 16, cursor: 'pointer', backgroundColor: '#4285F4', color: '#fff', border: 'none', borderRadius: 6, marginTop: 20 },
  logoutBtn: { padding: '6px 12px', cursor: 'pointer', background: '#f44336', color: '#fff', border: 'none', borderRadius: 4 },
  input: { flex: 1, padding: 8, borderRadius: 4, border: '1px solid #ccc', width: '100%' },
  btn: { padding: '8px 16px', background: '#4CAF50', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' },
  groupCard: { border: '1px solid #ddd', padding: 15, borderRadius: 8, marginBottom: 15, background: '#f9f9f9' },
  whatsappBtn: { display: 'inline-block', marginTop: 10, padding: '8px 14px', background: '#25D366', color: '#fff', textDecoration: 'none', borderRadius: 4, fontSize: 14 }
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PocketCircleApp />
  </React.StrictMode>
);