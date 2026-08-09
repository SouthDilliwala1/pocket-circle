import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function PocketCircleApp() {
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);
  
  // UI Modals
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);

  // Form States
  const [newGroupName, setNewGroupName] = useState('');
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
      setShowCreateGroupModal(false);
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
        created_by: session.user.id,
        description: title.trim(),
        amount: parseFloat(amount),
        category: category,
        payment_method: paymentMethod
      }
    ]);

    if (error) {
      alert(`Error adding expense: ${error.message}`);
    } else {
      setTitle('');
      setAmount('');
      setShowAddExpenseModal(false);
      fetchExpenses(selectedGroup.id);
    }
  };

  const getInviteLink = (groupId) => {
    return `${window.location.origin}?invite=${groupId}`;
  };

  if (loading) return <div style={styles.loading}>Loading PocketCircle...</div>;

  // 1. SIGN IN SCREEN
  if (!session) {
    return (
      <div style={styles.loginCard}>
        <div style={styles.logoBadge}>P</div>
        <h1>PocketCircle</h1>
        <p style={{ color: '#666', marginBottom: 20 }}>Shared expenses, made simple.</p>
        <button onClick={handleGoogleLogin} style={styles.googleBtn}>
          Sign in with Google
        </button>
      </div>
    );
  }

  const totalAmount = expenses.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
  const userInitial = session?.user?.email ? session.user.email[0].toUpperCase() : 'U';

  return (
    <div style={styles.appContainer}>
      {/* TOP HEADER */}
      <header style={styles.topHeader}>
        <div style={styles.headerLeft}>
          <div style={styles.logoBadge}>P</div>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>PocketCircle</h2>
            <span style={{ fontSize: 12, color: '#666' }}>Shared expenses, made simple</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={handleLogout} style={styles.logoutBtn}>Logout</button>
        </div>
      </header>

      {/* MAIN DASHBOARD LAYOUT */}
      <div style={styles.dashboardGrid}>
        
        {/* LEFT SIDEBAR: GROUPS */}
        <aside style={styles.sidebar}>
          <div style={styles.sidebarHeader}>
            <span style={{ fontWeight: 600, fontSize: 14, color: '#333' }}>Your groups</span>
            <button onClick={() => setShowCreateGroupModal(true)} style={styles.iconAddBtn}>+</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            {groups.map(group => {
              const isSelected = selectedGroup?.id === group.id;
              const isTrip = group.group_type?.toLowerCase().includes('trip');
              return (
                <div
                  key={group.id}
                  onClick={() => setSelectedGroup(group)}
                  style={{
                    ...styles.groupCardItem,
                    backgroundColor: isSelected ? '#eef5f1' : '#fff',
                    borderColor: isSelected ? '#22533e' : '#eee'
                  }}
                >
                  <span style={styles.groupIcon}>{isTrip ? '🌴' : '🏠'}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{group.name}</div>
                    <div style={{ fontSize: 12, color: '#777' }}>{group.group_type || 'Household'}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {selectedGroup && (
            <div style={styles.inviteBox}>
              <span style={{ fontSize: 11, color: '#666', fontWeight: 600 }}>INVITE MEMBERS</span>
              <a
                href={`https://api.whatsapp.com/send?text=Join%20my%20group%20on%20PocketCircle:%20${encodeURIComponent(getInviteLink(selectedGroup.id))}`}
                target="_blank"
                rel="noreferrer"
                style={styles.whatsappBtn}
              >
                Share link on WhatsApp 📲
              </a>
            </div>
          )}
        </aside>

        {/* RIGHT MAIN PANEL */}
        <main style={styles.mainContent}>
          {selectedGroup ? (
            <>
              {/* GROUP HEADER BAR */}
              <div style={styles.groupHeaderRow}>
                <div>
                  <div style={styles.categoryTag}>{(selectedGroup.group_type || 'HOUSEHOLD').toUpperCase()}</div>
                  <h1 style={{ margin: '4px 0', fontSize: 28, fontWeight: 800 }}>{selectedGroup.name}</h1>
                  <p style={{ margin: 0, fontSize: 13, color: '#666' }}>Every expense is visible to this group.</p>
                </div>
                <button onClick={() => setShowAddExpenseModal(true)} style={styles.addExpenseBtn}>
                  + Add expense
                </button>
              </div>

              {/* DARK GREEN TOTAL BANNER */}
              <div style={styles.totalBanner}>
                <div>
                  <div style={{ fontSize: 13, opacity: 0.9 }}>Total expenses</div>
                  <div style={{ fontSize: 32, fontWeight: 800, marginTop: 4 }}>₹{totalAmount.toLocaleString('en-IN')}</div>
                </div>
                <div style={{ textAlign: 'right', fontSize: 12, opacity: 0.9 }}>
                  <div>This group</div>
                  <div style={{ fontWeight: 600 }}>{expenses.length} expense{expenses.length === 1 ? '' : 's'} recorded</div>
                </div>
              </div>

              {/* TWO COLUMN DETAIL VIEW */}
              <div style={styles.detailGrid}>
                {/* MEMBERS LIST */}
                <div style={styles.detailCard}>
                  <div style={styles.cardHeader}>
                    <strong>Members</strong>
                  </div>
                  <div style={styles.memberRow}>
                    <div style={{ ...styles.avatar, backgroundColor: '#d1e7dd', color: '#0f5132' }}>{userInitial}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>You</div>
                      <div style={{ fontSize: 12, color: '#777' }}>₹{totalAmount}</div>
                    </div>
                  </div>
                </div>

                {/* ALL EXPENSES LIST */}
                <div style={styles.detailCard}>
                  <div style={styles.cardHeader}>
                    <div>
                      <strong>All expenses</strong>
                      <div style={{ fontSize: 11, color: '#888' }}>Newest expenses appear first.</div>
                    </div>
                  </div>

                  {expenses.length === 0 ? (
                    <div style={{ padding: '20px 0', color: '#888', fontSize: 13 }}>No expenses recorded yet in this group.</div>
                  ) : (
                    expenses.map(exp => (
                      <div key={exp.id} style={styles.expenseItem}>
                        <div style={{ ...styles.avatar, backgroundColor: '#e2e3e5', color: '#383d41' }}>
                          {(exp.description || 'E')[0].toUpperCase()}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 14, color: '#222' }}>{exp.description || exp.title}</div>
                          <div style={{ fontSize: 12, color: '#777' }}>
                            {exp.category || 'General'} {exp.payment_method ? `• ${exp.payment_method}` : ''}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 700, fontSize: 15, color: '#111' }}>
                            ₹{Number(exp.amount).toLocaleString('en-IN')}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          ) : (
            <div style={{ padding: 40, textAlign: 'center', color: '#666' }}>
              Select or create a group from the left sidebar to start.
            </div>
          )}
        </main>
      </div>

      {/* CREATE GROUP MODAL */}
      {showCreateGroupModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBody}>
            <h3>Create a New Group</h3>
            <form onSubmit={createGroup}>
              <input
                type="text"
                placeholder="Group Name (e.g. Bansal Home, Goa Trip)"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                style={styles.modalInput}
                required
              />
              <div style={styles.modalActions}>
                <button type="button" onClick={() => setShowCreateGroupModal(false)} style={styles.cancelBtn}>Cancel</button>
                <button type="submit" style={styles.saveBtn}>Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD EXPENSE MODAL */}
      {showAddExpenseModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBody}>
            <h3>Add New Expense</h3>
            <form onSubmit={addExpense} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                type="text"
                placeholder="What was this for? (e.g. Groceries)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={styles.modalInput}
                required
              />
              <input
                type="number"
                placeholder="Amount (₹)"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={styles.modalInput}
                required
              />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={styles.modalInput}
              >
                <option value="Groceries">Groceries</option>
                <option value="Rent/Bills">Rent/Bills</option>
                <option value="Dining">Dining</option>
                <option value="Trip">Trip</option>
                <option value="Fuel">Fuel</option>
                <option value="Other">Other</option>
              </select>

              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                style={styles.modalInput}
              >
                <option value="UPI">UPI</option>
                <option value="Cash">Cash</option>
                <option value="Credit Card">Credit Card</option>
                <option value="Debit Card">Debit Card</option>
              </select>

              <div style={styles.modalActions}>
                <button type="button" onClick={() => setShowAddExpenseModal(false)} style={styles.cancelBtn}>Cancel</button>
                <button type="submit" style={styles.saveBtn}>Save Expense</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  appContainer: { minHeight: '100vh', backgroundColor: '#f8f9fa', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#212529' },
  topHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', backgroundColor: '#fff', borderBottom: '1px solid #eaeaea' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  logoBadge: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#22533e', color: '#fff', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 },
  logoutBtn: { padding: '6px 12px', borderRadius: 6, border: '1px solid #ddd', backgroundColor: '#fff', cursor: 'pointer', fontSize: 12 },
  dashboardGrid: { display: 'grid', gridTemplateColumns: '260px 1fr', maxWidth: 1100, margin: '24px auto', gap: 24, padding: '0 16px' },
  sidebar: { backgroundColor: '#f8f9fa' },
  sidebarHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  iconAddBtn: { width: 24, height: 24, borderRadius: '50%', border: 'none', backgroundColor: '#e2e8f0', cursor: 'pointer', fontWeight: 700 },
  groupCardItem: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, border: '1px solid #eee', cursor: 'pointer', transition: '0.2s' },
  groupIcon: { fontSize: 20 },
  inviteBox: { marginTop: 24, padding: 12, borderRadius: 8, backgroundColor: '#fff', border: '1px solid #eee', display: 'flex', flexDirection: 'column', gap: 8 },
  whatsappBtn: { fontSize: 12, backgroundColor: '#25D366', color: '#fff', textDecoration: 'none', padding: '8px 10px', borderRadius: 6, textAlign: 'center', fontWeight: 600 },
  mainContent: { display: 'flex', flexDirection: 'column', gap: 16 },
  groupHeaderRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  categoryTag: { fontSize: 11, fontWeight: 700, color: '#22533e', letterSpacing: 0.5 },
  addExpenseBtn: { backgroundColor: '#22533e', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 20, fontWeight: 700, cursor: 'pointer', fontSize: 14 },
  totalBanner: { backgroundColor: '#22533e', color: '#fff', borderRadius: 16, padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  detailGrid: { display: 'grid', gridTemplateColumns: '200px 1fr', gap: 16, marginTop: 8 },
  detailCard: { backgroundColor: '#fff', borderRadius: 12, border: '1px solid #eee', padding: 16 },
  cardHeader: { paddingBottom: 12, borderBottom: '1px solid #f0f0f0', marginBottom: 12 },
  memberRow: { display: 'flex', alignItems: 'center', gap: 10 },
  avatar: { width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 },
  expenseItem: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #f5f5f5' },
  loginCard: { maxWidth: 360, margin: '120px auto', padding: 32, borderRadius: 16, backgroundColor: '#fff', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' },
  googleBtn: { width: '100%', padding: '12px', backgroundColor: '#4285F4', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 15 },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modalBody: { backgroundColor: '#fff', borderRadius: 12, padding: 24, width: 340, boxShadow: '0 8px 30px rgba(0,0,0,0.12)' },
  modalInput: { width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #ccc', boxSizing: 'border-box' },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 },
  cancelBtn: { padding: '8px 14px', borderRadius: 6, border: '1px solid #ccc', backgroundColor: '#fff', cursor: 'pointer' },
  saveBtn: { padding: '8px 14px', borderRadius: 6, border: 'none', backgroundColor: '#22533e', color: '#fff', fontWeight: 600, cursor: 'pointer' },
  loading: { padding: 40, textAlign: 'center', fontFamily: 'sans-serif' }
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PocketCircleApp />
  </React.StrictMode>
);