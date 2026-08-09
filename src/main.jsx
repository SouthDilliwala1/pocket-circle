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
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [newGroupName, setNewGroupName] = useState('');

  // Expense Form State
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Groceries');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      handleInviteAndFetchGroups();
    }
  }, [session]);

  useEffect(() => {
    if (selectedGroup) {
      fetchExpenses(selectedGroup.id);
    }
  }, [selectedGroup]);

  // Handle URL invite parameters and fetch groups
  const handleInviteAndFetchGroups = async () => {
    const params = new URLSearchParams(window.location.search);
    const inviteGroupId = params.get('invite');

    if (inviteGroupId && session) {
      await supabase.from('group_members').insert([
        { group_id: inviteGroupId, user_id: session.user.id, role: 'member' }
      ]);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    fetchGroups();
  };

  const fetchGroups = async () => {
    const { data, error } = await supabase.from('groups').select('*');
    if (!error && data) {
      setGroups(data);
      if (data.length > 0 && !selectedGroup) {
        setSelectedGroup(data[0]);
      }
    }
  };

  const fetchExpenses = async (groupId) => {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });

    if (!error) setExpenses(data || []);
  };

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSelectedGroup(null);
  };

  const createGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    const { data, error } = await supabase
      .from('groups')
      .insert([{ name: newGroupName, group_type: 'Household', owner_id: session.user.id }])
      .select()
      .single();

    if (error) {
      alert(`Error creating group: ${error.message}`);
      return;
    }

    if (data) {
      await supabase.from('group_members').insert([
        { group_id: data.id, user_id: session.user.id, role: 'owner' }
      ]);

      setNewGroupName('');
      fetchGroups();
      setSelectedGroup(data);
    }
  };

  const addExpense = async (e) => {
    e.preventDefault();
    if (!title.trim() || !amount || !selectedGroup) return;

    const { error } = await supabase.from('expenses').insert([
      {
        group_id: selectedGroup.id,
        paid_by: session.user.id,
        description: title.trim(),
        amount: parseFloat(amount),
        category: category
      }
    ]);

    if (error) {
      alert(`Error adding expense: ${error.message}`);
    } else {
      setTitle('');
      setAmount('');
      fetchExpenses(selectedGroup.id);
    }
  };

  const getInviteLink = (groupId) => {
    return `${window.location.origin}?invite=${groupId}`;
  };

  if (loading) return <div style={{ padding: 20 }}>Loading PocketCircle...</div>;

  // 1. SIGN IN SCREEN
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

  // 2. DASHBOARD
  const totalAmount = expenses.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h2>PocketCircle ⭕</h2>
        <button onClick={handleLogout} style={styles.logoutBtn}>Logout</button>
      </header>

      {/* Group Selector & Creator */}
      <section style={{ marginTop: 20 }}>
        <h3>Your Groups</h3>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 15 }}>
          {groups.map(group => (
            <button
              key={group.id}
              onClick={() => setSelectedGroup(group)}
              style={{
                ...styles.groupTab,
                border: selectedGroup?.id === group.id ? '2px solid #2e7d32' : '1px solid #ccc',
                background: selectedGroup?.id === group.id ? '#e8f5e9' : '#fff'
              }}
            >
              🏡 {group.name}
            </button>
          ))}
        </div>

        <form onSubmit={createGroup} style={{ display: 'flex', gap: 10, marginBottom: 25 }}>
          <input
            type="text"
            placeholder="+ Create New Group Name"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            style={styles.input}
          />
          <button type="submit" style={styles.btn}>Create</button>
        </form>
      </section>

      {selectedGroup ? (
        <>
          {/* Active Group Details & Invites */}
          <div style={styles.activeGroupCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>{selectedGroup.name}</h3>
              <span style={{ fontSize: 14, color: '#666' }}>Total: <strong>₹{totalAmount}</strong></span>
            </div>

            <div style={{ marginTop: 10 }}>
              <p style={{ fontSize: 12, color: '#555', margin: '4px 0' }}>Invite Link for Members:</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  type="text"
                  readOnly
                  value={getInviteLink(selectedGroup.id)}
                  style={styles.input}
                  onClick={(e) => e.target.select()}
                />
                <a
                  href={`https://api.whatsapp.com/send?text=Join%20my%20group%20on%20PocketCircle:%20${encodeURIComponent(getInviteLink(selectedGroup.id))}`}
                  target="_blank"
                  rel="noreferrer"
                  style={styles.whatsappBtn}
                >
                  WhatsApp 📲
                </a>
              </div>
            </div>
          </div>

          {/* Add Expense Form */}
          <div style={styles.formCard}>
            <h4>+ Record New Expense</h4>
            <form onSubmit={addExpense} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                type="text"
                placeholder="What was this for? (e.g. Milk & Bread)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={styles.input}
                required
              />
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  type="number"
                  placeholder="Amount (₹)"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  style={styles.input}
                  required
                />
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  style={styles.input}
                >
                  <option value="Groceries">Groceries</option>
                  <option value="Rent/Bills">Rent/Bills</option>
                  <option value="Dining">Dining</option>
                  <option value="Trip">Trip</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <button type="submit" style={styles.addBtn}>Add Expense</button>
            </form>
          </div>

          {/* Expenses List */}
          <h4>Recent Expenses</h4>
          {expenses.length === 0 ? (
            <p style={{ color: '#666' }}>No expenses recorded yet in this group.</p>
          ) : (
            expenses.map(exp => (
              <div key={exp.id} style={styles.expenseRow}>
                <div>
                  <strong>{exp.description || exp.title}</strong>
                  <div style={{ fontSize: 12, color: '#777' }}>{exp.category}</div>
                </div>
                <div style={{ fontSize: 16, fontWeight: 'bold', color: '#2e7d32' }}>
                  ₹{exp.amount}
                </div>
              </div>
            ))
          )}
        </>
      ) : (
        <p>Select or create a group to start tracking expenses.</p>
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
  input: { flex: 1, padding: 10, borderRadius: 6, border: '1px solid #ccc' },
  btn: { padding: '10px 16px', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' },
  addBtn: { padding: '12px', background: '#1b5e20', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' },
  groupTab: { padding: '8px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 14 },
  activeGroupCard: { border: '1px solid #2e7d32', padding: 15, borderRadius: 8, marginBottom: 20, background: '#f1f8e9' },
  formCard: { border: '1px solid #eee', padding: 15, borderRadius: 8, marginBottom: 20, background: '#fafafa' },
  whatsappBtn: { padding: '10px 14px', background: '#25D366', color: '#fff', textDecoration: 'none', borderRadius: 6, fontSize: 14, alignSelf: 'center' },
  expenseRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #eee' }
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PocketCircleApp />
  </React.StrictMode>
);