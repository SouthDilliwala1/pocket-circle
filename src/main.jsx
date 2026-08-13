import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function Avatar({ url, name, size = 36, style = {} }) {
  const [imgError, setImgError] = useState(false);
  const initial = (name || '?')[0].toUpperCase();
  const colors = ['#2d6a4f','#1e6091','#7b2d8b','#c05621','#276749','#2c5282'];
  const color = colors[(name || '').charCodeAt(0) % colors.length];
  if (url && !imgError) return (
    <img
      src={url}
      alt={name}
      onError={() => setImgError(true)}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, ...style }}
    />
  );
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: size * 0.4, flexShrink: 0, ...style }}>
      {initial}
    </div>
  );
}

function Toast({ message, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, []);
  return (
    <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: '#1a1a1a', color: '#fff', padding: '12px 20px', borderRadius: 12, fontSize: 14, fontWeight: 600, zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,0.3)', whiteSpace: 'nowrap' }}>
      {message}
    </div>
  );
}

export default function App() {
  const [session, setSession]                 = useState(null);
  const [loading, setLoading]                 = useState(true);
  const [profile, setProfile]                 = useState(null);
  const [groups, setGroups]                   = useState([]);
  const [selectedGroup, setSelectedGroup]     = useState(null);
  const [groupMembers, setGroupMembers]       = useState([]);
  const [expenses, setExpenses]               = useState([]);
  const [notifications, setNotifications]     = useState([]);
  const [unreadCount, setUnreadCount]         = useState(0);
  const [toast, setToast]                     = useState('');
  const [screen, setScreen]                   = useState('home');
  const [showFab, setShowFab]                 = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal]     = useState(false);
  const [showAddExpense, setShowAddExpense]   = useState(false);
  const [showGroupCode, setShowGroupCode]     = useState(false);
  const [showNotifs, setShowNotifs]           = useState(false);
  const [editingExpense, setEditingExpense]   = useState(null);
  const [newGroupName, setNewGroupName]       = useState('');
  const [newGroupType, setNewGroupType]       = useState('Household');
  const [joinCode, setJoinCode]               = useState('');

  // Expense form state
  const [expTitle, setExpTitle]       = useState('');
  const [expAmount, setExpAmount]     = useState('');
  const [expCategory, setExpCategory] = useState('Groceries');
  const [expPayment, setExpPayment]   = useState('UPI');
  const [expNote, setExpNote]         = useState('');
  const [expDate, setExpDate]         = useState('');
  const [expSplit, setExpSplit]       = useState('self'); // self | equal | exact | percentage
  const [expPaidBy, setExpPaidBy]     = useState('');
  const [submitting, setSubmitting]   = useState(false);

  const joinCodeRef = useRef(null);

  // ── Auth ──────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      ensureProfile(session.user);
      fetchGroups();
      fetchNotifications();
    }
  }, [session]);

  useEffect(() => {
    if (selectedGroup) {
      fetchMembers(selectedGroup.id);
      fetchExpenses(selectedGroup.id);
    }
  }, [selectedGroup]);

  // ── Profile — always sync Google photo ────────────────────────
  const ensureProfile = async (user) => {
    const meta = user.user_metadata || {};
    // Try every possible field Google might send
    const avatarUrl = meta.avatar_url || meta.picture || meta.photo_url || meta.photo || null;
    const displayName = meta.full_name || meta.name || user.email;

    const { data, error } = await supabase
      .from('profiles').select('*').eq('id', user.id).single();

    if (error || !data) {
      // Insert new profile
      const { data: newP } = await supabase.from('profiles')
        .insert([{ id: user.id, display_name: displayName, avatar_url: avatarUrl }])
        .select().single();
      setProfile(newP || { id: user.id, display_name: displayName, avatar_url: avatarUrl });
    } else {
      // Always update avatar from Google in case it changed
      const { data: updated } = await supabase.from('profiles')
        .update({ avatar_url: avatarUrl, display_name: displayName })
        .eq('id', user.id).select().single();
      setProfile(updated || data);
    }
  };

  // ── Groups ─────────────────────────────────────────────────────
  const fetchGroups = async () => {
    const { data } = await supabase.from('groups').select('*');
    if (data) setGroups(data);
  };

  const fetchMembers = async (groupId) => {
    const { data } = await supabase
      .from('group_members')
      .select('user_id, role, profiles(display_name, avatar_url)')
      .eq('group_id', groupId);
    if (data) setGroupMembers(data);
  };

  const fetchExpenses = async (groupId) => {
    const { data } = await supabase
      .from('expenses')
      .select('*, profiles(display_name, avatar_url)')
      .gt('id', '00000000-0000-0000-0000-000000000000')
      .eq('group_id', groupId)
      .order('spent_at', { ascending: false });
    setExpenses(data || []);
  };

  const fetchNotifications = async () => {
    if (!session) return;
    const { data } = await supabase
      .from('notifications').select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false }).limit(20);
    if (data) { setNotifications(data); setUnreadCount(data.filter(n => !n.read).length); }
  };

  const markNotifsRead = async () => {
    await supabase.from('notifications').update({ read: true })
      .eq('user_id', session.user.id).eq('read', false);
    setUnreadCount(0);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  // ── Create Group ───────────────────────────────────────────────
  const createGroup = async () => {
    if (!newGroupName.trim() || submitting) return;
    setSubmitting(true);
    let code = generateCode();
    for (let i = 0; i < 10; i++) {
      const { data: ex } = await supabase.from('groups').select('id').eq('invite_code', code).single();
      if (!ex) break;
      code = generateCode();
    }
    const { data, error } = await supabase.from('groups')
      .insert([{ name: newGroupName.trim(), group_type: newGroupType, owner_id: session.user.id, invite_code: code }])
      .select().single();
    if (error) { showToast('Error: ' + error.message); setSubmitting(false); return; }
    await supabase.from('group_members')
      .insert([{ group_id: data.id, user_id: session.user.id, role: 'owner' }]);
    setNewGroupName(''); setNewGroupType('Household');
    setShowCreateModal(false); setSubmitting(false);
    await fetchGroups();
    setSelectedGroup(data); setScreen('group');
    showToast('Group created! 🎉');
  };

  // ── Join Group ─────────────────────────────────────────────────
  const joinGroup = async () => {
    const code = joinCode.trim();
    if (code.length !== 6 || submitting) return;
    setSubmitting(true);
    const { data: group, error } = await supabase.from('groups').select('*').eq('invite_code', code).single();
    if (error || !group) { showToast('Invalid code. Try again.'); setSubmitting(false); return; }
    const { data: existing } = await supabase.from('group_members')
      .select('user_id').eq('group_id', group.id).eq('user_id', session.user.id).single();
    if (existing) { showToast('Already in this group!'); setSubmitting(false); setJoinCode(''); setShowJoinModal(false); return; }
    const { count } = await supabase.from('group_members')
      .select('*', { count: 'exact', head: true }).eq('group_id', group.id);
    if (count >= 11) { showToast('Group is full!'); setSubmitting(false); return; }
    await supabase.from('group_members')
      .insert([{ group_id: group.id, user_id: session.user.id, role: 'member' }]);
    const memberName = profile?.display_name || session.user.email;
    await supabase.from('notifications')
      .insert([{ user_id: group.owner_id, message: `${memberName} joined your group "${group.name}"` }]);
    setJoinCode(''); setShowJoinModal(false); setSubmitting(false);
    await fetchGroups();
    setSelectedGroup(group); setScreen('group');
    showToast(`Joined ${group.name}! 🎉`);
  };

  // ── Expenses ───────────────────────────────────────────────────
  const openAddExpense = () => {
    setEditingExpense(null);
    setExpTitle(''); setExpAmount(''); setExpCategory('Groceries');
    setExpPayment('UPI'); setExpNote(''); setExpSplit('self');
    setExpPaidBy(session.user.id);
    setExpDate(new Date().toISOString().slice(0, 16));
    setShowAddExpense(true);
  };

  const openEditExpense = (exp) => {
    setEditingExpense(exp);
    setExpTitle(exp.description || '');
    setExpAmount(String(exp.amount || ''));
    setExpCategory(exp.category || 'Groceries');
    setExpPayment(exp.payment_method || 'UPI');
    setExpNote(exp.notes || '');
    setExpSplit(exp.split_method || 'self');
    setExpPaidBy(exp.paid_by || session.user.id);
    setExpDate(exp.spent_at ? exp.spent_at.slice(0, 16) : new Date().toISOString().slice(0, 16));
    setShowAddExpense(true);
  };

  const saveExpense = async () => {
    if (!expTitle.trim() || !expAmount || submitting) return;
    setSubmitting(true);
    const payload = {
      group_id: selectedGroup.id,
      paid_by: expPaidBy || session.user.id,
      created_by: session.user.id,
      description: expTitle.trim(),
      amount: parseFloat(expAmount),
      category: expCategory,
      payment_method: expPayment,
      notes: expNote.trim() || null,
      spent_at: expDate ? new Date(expDate).toISOString() : new Date().toISOString(),
      split_method: expSplit,
      is_deleted: false,
    };
    if (editingExpense) {
      const { error } = await supabase.from('expenses').update(payload).eq('id', editingExpense.id);
      if (error) { showToast('Error: ' + error.message); setSubmitting(false); return; }
      showToast('Expense updated ✓');
    } else {
      const { error } = await supabase.from('expenses').insert([payload]);
      if (error) { showToast('Error: ' + error.message); setSubmitting(false); return; }
      showToast('Expense added ✓');
    }
    setShowAddExpense(false); setSubmitting(false);
    setExpenses([]);
    await fetchExpenses(selectedGroup.id);
  };

  const deleteExpense = async (expId) => {
    if (!confirm('Delete this expense?')) return;
    await supabase.from('expenses').update({ is_deleted: true }).eq('id', expId);
    showToast('Expense removed');
    fetchExpenses(selectedGroup.id);
  };

  // ── Refresh invite code ────────────────────────────────────────
  const refreshCode = async () => {
    if (!confirm('Generate a new code? The old one will stop working.')) return;
    let code = generateCode();
    for (let i = 0; i < 10; i++) {
      const { data: ex } = await supabase.from('groups').select('id').eq('invite_code', code).single();
      if (!ex) break;
      code = generateCode();
    }
    const { error } = await supabase.from('groups').update({ invite_code: code }).eq('id', selectedGroup.id);
    if (error) { showToast('Error refreshing code'); return; }
    const updated = { ...selectedGroup, invite_code: code };
    setSelectedGroup(updated);
    setGroups(prev => prev.map(g => g.id === updated.id ? updated : g));
    showToast('New code generated ✓');
  };

  const copyCode = () => {
    navigator.clipboard.writeText(selectedGroup?.invite_code || '');
    showToast('Code copied!');
  };

  // ── Leave / Remove / Delete ────────────────────────────────────
  const leaveGroup = async () => {
    if (!confirm(`Leave "${selectedGroup.name}"?`)) return;
    await supabase.from('group_members').delete()
      .eq('group_id', selectedGroup.id).eq('user_id', session.user.id);
    setSelectedGroup(null); setScreen('home'); fetchGroups();
    showToast('You left the group');
  };

  const removeMember = async (userId) => {
    if (!confirm('Remove this member?')) return;
    await supabase.from('group_members').delete()
      .eq('group_id', selectedGroup.id).eq('user_id', userId);
    fetchMembers(selectedGroup.id);
    showToast('Member removed');
  };

  const deleteGroup = async () => {
    if (!confirm(`Delete "${selectedGroup.name}"? This cannot be undone.`)) return;
    if (!confirm('Are you 100% sure?')) return;
    await supabase.from('expenses').update({ is_deleted: true }).eq('group_id', selectedGroup.id);
    await supabase.from('group_members').delete().eq('group_id', selectedGroup.id);
    await supabase.from('groups').delete().eq('id', selectedGroup.id);
    setSelectedGroup(null); setScreen('home');
    await fetchGroups();
    showToast('Group deleted');
  };

  const showToast = (msg) => setToast(msg);
  const isAdmin = selectedGroup && session && selectedGroup.owner_id === session.user.id;
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const handleLogout = async () => { await supabase.auth.signOut(); setGroups([]); setSelectedGroup(null); setScreen('home'); };

  // ── Loading ────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f7f4', fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: '#22533e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 800, margin: '0 auto 14px' }}>P</div>
        <div style={{ color: '#22533e', fontWeight: 700 }}>Loading…</div>
      </div>
    </div>
  );

  // ── Sign In ────────────────────────────────────────────────────
  if (!session) return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#eaf4ee,#f4f7f4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui,sans-serif', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 24, padding: '40px 32px', maxWidth: 360, width: '100%', textAlign: 'center', boxShadow: '0 8px 40px rgba(0,0,0,0.10)' }}>
        <div style={{ width: 64, height: 64, borderRadius: 18, background: '#22533e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, fontWeight: 800, margin: '0 auto 16px' }}>P</div>
        <h1 style={{ margin: '0 0 6px', fontSize: 26, fontWeight: 800, color: '#1a1a1a' }}>PocketCircle</h1>
        <p style={{ color: '#666', marginBottom: 32, fontSize: 15 }}>Shared expenses, made simple.</p>
        <button onClick={() => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })}
          style={{ width: '100%', padding: 14, background: '#fff', color: '#333', border: '1.5px solid #ddd', borderRadius: 12, fontWeight: 700, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#4285F4" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z"/><path fill="#34A853" d="M6.3 14.7l6.6 4.8C14.7 16.1 19 13 24 13c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/><path fill="#FBBC05" d="M24 44c5.2 0 9.9-1.9 13.4-5l-6.2-5.2C29.3 35.5 26.8 36 24 36c-5.2 0-9.7-3.3-11.3-7.9l-6.6 4.8C9.6 39.4 16.3 44 24 44z"/><path fill="#EA4335" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C42.5 35.4 44 30 44 24c0-1.2-.1-2.4-.4-3.5z"/></svg>
          Sign in with Google
        </button>
      </div>
    </div>
  );

  // ══════════════════════════════════════════
  //  HOME SCREEN
  // ══════════════════════════════════════════
  if (screen === 'home') return (
    <div style={S.app}>
      <header style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={S.logoBadge}>P</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17, color: '#1a1a1a' }}>PocketCircle</div>
            <div style={{ fontSize: 12, color: '#666' }}>Hi, {profile?.display_name?.split(' ')[0] || 'there'} 👋</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => { setShowNotifs(true); markNotifsRead(); }} style={{ ...S.iconBtn, position: 'relative' }}>
            🔔{unreadCount > 0 && <span style={S.badge}>{unreadCount}</span>}
          </button>
          <Avatar url={profile?.avatar_url} name={profile?.display_name || 'U'} size={36} />
          <button onClick={handleLogout} style={S.logoutBtn}>Sign out</button>
        </div>
      </header>

      <div style={{ padding: '20px 16px', flex: 1, overflowY: 'auto' }}>
        <div style={{ fontWeight: 700, fontSize: 18, color: '#1a1a1a', marginBottom: 14 }}>Your Groups</div>
        {groups.length === 0 ? (
          <div style={S.emptyState}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>🏠</div>
            <div style={{ fontWeight: 700, fontSize: 17, color: '#333', marginBottom: 6 }}>No groups yet</div>
            <div style={{ color: '#888', fontSize: 14 }}>Tap + to create or join a group</div>
          </div>
        ) : groups.map(g => (
          <div key={g.id} onClick={() => { setSelectedGroup(g); setScreen('group'); }} style={S.groupCard}>
            <div style={{ ...S.groupIconBox, background: g.group_type === 'Trip' ? '#fff3e0' : '#e8f5e9' }}>
              {g.group_type === 'Trip' ? '🌴' : '🏠'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#1a1a1a' }}>{g.name}</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{g.group_type}</div>
            </div>
            <div style={{ color: '#bbb', fontSize: 20 }}>›</div>
          </div>
        ))}
      </div>

      <button onClick={() => setShowFab(true)} style={S.fab}>+</button>

      {showFab && (
        <div style={S.overlay} onClick={() => setShowFab(false)}>
          <div style={{ ...S.sheet, padding: '24px 20px 36px' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16, color: '#333' }}>What would you like to do?</div>
            <button onClick={() => { setShowFab(false); setShowCreateModal(true); }} style={S.sheetBtn}>
              <span style={{ fontSize: 24 }}>➕</span>
              <div><div style={{ fontWeight: 700, fontSize: 15 }}>Create a group</div><div style={{ fontSize: 12, color: '#888' }}>Start a new household or trip</div></div>
            </button>
            <button onClick={() => { setShowFab(false); setShowJoinModal(true); setTimeout(() => joinCodeRef.current?.focus(), 200); }} style={S.sheetBtn}>
              <span style={{ fontSize: 24 }}>🔢</span>
              <div><div style={{ fontWeight: 700, fontSize: 15 }}>Join a group</div><div style={{ fontSize: 12, color: '#888' }}>Enter a 6-digit invite code</div></div>
            </button>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div style={S.overlay} onClick={() => setShowCreateModal(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalTitle}>Create a New Group</div>
            <label style={S.label}>Group Name</label>
            <input autoFocus value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
              placeholder="e.g. Bansal Home, Goa Trip" style={S.input}
              onKeyDown={e => e.key === 'Enter' && createGroup()} />
            <label style={S.label}>Group Type</label>
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              {['Household','Trip'].map(t => (
                <button key={t} onClick={() => setNewGroupType(t)}
                  style={{ ...S.chip, ...(newGroupType === t ? S.chipActive : {}), flex: 1, textAlign: 'center' }}>
                  {t === 'Trip' ? '🌴' : '🏠'} {t}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowCreateModal(false)} style={S.cancelBtn}>Cancel</button>
              <button onClick={createGroup} disabled={submitting || !newGroupName.trim()} style={S.primaryBtn}>
                {submitting ? 'Creating…' : 'Create Group'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showJoinModal && (
        <div style={S.overlay} onClick={() => setShowJoinModal(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalTitle}>Join a Group</div>
            <p style={{ color: '#666', fontSize: 14, marginBottom: 16 }}>Enter the 6-digit code from the group admin.</p>
            <input ref={joinCodeRef} value={joinCode}
              onChange={e => setJoinCode(e.target.value.replace(/\D/g,'').slice(0,6))}
              placeholder="000000" maxLength={6} inputMode="numeric"
              style={{ ...S.input, fontSize: 32, fontWeight: 800, letterSpacing: 10, textAlign: 'center', marginBottom: 16 }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setShowJoinModal(false); setJoinCode(''); }} style={S.cancelBtn}>Cancel</button>
              <button onClick={joinGroup} disabled={submitting || joinCode.length !== 6} style={S.primaryBtn}>
                {submitting ? 'Joining…' : 'Join Group'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showNotifs && <NotifsDrawer notifications={notifications} onClose={() => setShowNotifs(false)} />}
      {toast && <Toast message={toast} onDone={() => setToast('')} />}
    </div>
  );

  // ══════════════════════════════════════════
  //  GROUP SCREEN
  // ══════════════════════════════════════════
  return (
    <div style={S.app}>
      <header style={S.header}>
        <button onClick={() => { setScreen('home'); setSelectedGroup(null); }} style={S.backBtn}>‹ Groups</button>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#1a1a1a', flex: 1, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedGroup?.name}
        </div>
        <button onClick={() => { setShowNotifs(true); markNotifsRead(); }} style={{ ...S.iconBtn, position: 'relative' }}>
          🔔{unreadCount > 0 && <span style={S.badge}>{unreadCount}</span>}
        </button>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {/* Banner */}
        <div style={S.bannerCard}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.8, letterSpacing: 1, textTransform: 'uppercase' }}>{selectedGroup?.group_type}</div>
            <div style={{ fontSize: 30, fontWeight: 800, marginTop: 4 }}>₹{totalExpenses.toLocaleString('en-IN')}</div>
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>{expenses.length} {expenses.length === 1 ? 'expense' : 'expenses'}</div>
          </div>
          {isAdmin && (
            <button onClick={() => setShowGroupCode(true)}
              style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 10, padding: '10px 14px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              🔑 Invite Code
            </button>
          )}
        </div>

        {/* Members */}
        <div style={S.section}>
          <div style={{ ...S.sectionTitle, marginBottom: 12 }}>Members ({groupMembers.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {groupMembers.map(m => {
              const p = m.profiles || {};
              const isMe = m.user_id === session.user.id;
              const isOwner = m.role === 'owner';
              return (
                <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar url={p.avatar_url} name={p.display_name || '?'} size={40} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#1a1a1a' }}>
                      {p.display_name || 'Member'}{isMe ? ' (You)' : ''}
                    </div>
                    <div style={{ fontSize: 12, color: isOwner ? '#22533e' : '#888', fontWeight: isOwner ? 700 : 400 }}>
                      {isOwner ? '👑 Admin' : 'Member'}
                    </div>
                  </div>
                  {isAdmin && !isMe && !isOwner && (
                    <button onClick={() => removeMember(m.user_id)}
                      style={{ border: '1px solid #fca5a5', color: '#e53e3e', background: 'none', borderRadius: 8, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                      Remove
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            {!isAdmin && (
              <button onClick={leaveGroup}
                style={{ border: '1px solid #fca5a5', color: '#e53e3e', background: 'none', borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Leave Group
              </button>
            )}
            {isAdmin && (
              <button onClick={deleteGroup}
                style={{ border: '1px solid #fca5a5', color: '#e53e3e', background: '#fff5f5', borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                🗑️ Delete Group
              </button>
            )}
          </div>
        </div>

        {/* Expenses */}
        <div style={S.section}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={S.sectionTitle}>Expenses</div>
            <button onClick={openAddExpense} style={S.addBtn}>+ Add</button>
          </div>
          {expenses.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#aaa', padding: '28px 0', fontSize: 14 }}>
              No expenses yet. Tap + Add to record one.
            </div>
          ) : expenses.map(exp => {
            const paidBy = exp.profiles || {};
            const isMyExp = exp.created_by === session.user.id;
            const splitLabel = { self: 'Paid by self', equal: 'Split equally', exact: 'Exact split', percentage: '% split' };
            return (
              <div key={exp.id} style={S.expenseRow}>
                <Avatar url={paidBy.avatar_url} name={paidBy.display_name || '?'} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#1a1a1a' }}>{exp.description}</div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                    {paidBy.display_name || 'Member'} · {exp.category} · {exp.payment_method}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                    <span style={S.tag}>{splitLabel[exp.split_method] || 'Paid by self'}</span>
                  </div>
                  {exp.notes && <div style={{ fontSize: 12, color: '#666', marginTop: 3, fontStyle: 'italic' }}>"{exp.notes}"</div>}
                  <div style={{ fontSize: 11, color: '#bbb', marginTop: 3 }}>
                    {exp.spent_at ? new Date(exp.spent_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 16, color: '#22533e' }}>₹{Number(exp.amount).toLocaleString('en-IN')}</div>
                  {isMyExp && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 6, justifyContent: 'flex-end' }}>
                      <button onClick={() => openEditExpense(exp)} style={S.miniBtn}>Edit</button>
                      <button onClick={() => deleteExpense(exp.id)} style={{ ...S.miniBtn, color: '#e53e3e', borderColor: '#fca5a5' }}>Del</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add/Edit Expense Modal */}
      {showAddExpense && (
        <div style={S.overlay} onClick={() => setShowAddExpense(false)}>
          <div style={{ ...S.modal, maxHeight: '92vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={S.modalTitle}>{editingExpense ? 'Edit Expense' : 'Add Expense'}</div>

            <label style={S.label}>Description *</label>
            <input autoFocus value={expTitle} onChange={e => setExpTitle(e.target.value)}
              placeholder="What was this for?" style={S.input} />

            <label style={S.label}>Amount (₹) *</label>
            <input type="number" value={expAmount} onChange={e => setExpAmount(e.target.value)}
              placeholder="0" inputMode="decimal" style={S.input} />

            <label style={S.label}>Paid By</label>
            <div style={S.chipRow}>
              {groupMembers.map(m => {
                const p = m.profiles || {};
                const isSelected = expPaidBy === m.user_id;
                return (
                  <button key={m.user_id} onClick={() => setExpPaidBy(m.user_id)}
                    style={{ ...S.chip, ...(isSelected ? S.chipActive : {}), display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Avatar url={p.avatar_url} name={p.display_name || '?'} size={20} />
                    {m.user_id === session.user.id ? 'You' : (p.display_name?.split(' ')[0] || 'Member')}
                  </button>
                );
              })}
            </div>

            <label style={S.label}>Split Type</label>
            <div style={S.chipRow}>
              {[
                { key: 'self', label: '👤 Self' },
                { key: 'equal', label: '⚖️ Equal' },
                { key: 'exact', label: '🔢 Exact' },
                { key: 'percentage', label: '% Percent' },
              ].map(s => (
                <button key={s.key} onClick={() => setExpSplit(s.key)}
                  style={{ ...S.chip, ...(expSplit === s.key ? S.chipActive : {}) }}>
                  {s.label}
                </button>
              ))}
            </div>

            <label style={S.label}>Category</label>
            <div style={S.chipRow}>
              {['Groceries','Rent/Bills','Dining','Fuel','Trip','Shopping','Other'].map(c => (
                <button key={c} onClick={() => setExpCategory(c)}
                  style={{ ...S.chip, ...(expCategory === c ? S.chipActive : {}) }}>{c}</button>
              ))}
            </div>

            <label style={S.label}>Payment Method</label>
            <div style={S.chipRow}>
              {['UPI','Cash','Credit','Debit'].map(p => (
                <button key={p} onClick={() => setExpPayment(p)}
                  style={{ ...S.chip, ...(expPayment === p ? S.chipActive : {}) }}>{p}</button>
              ))}
            </div>

            <label style={S.label}>Date & Time</label>
            <input type="datetime-local" value={expDate} onChange={e => setExpDate(e.target.value)} style={S.input} />

            <label style={S.label}>Notes (optional)</label>
            <input value={expNote} onChange={e => setExpNote(e.target.value)}
              placeholder="Add a note…" style={S.input} />

            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <button onClick={() => setShowAddExpense(false)} style={S.cancelBtn}>Cancel</button>
              <button onClick={saveExpense} disabled={submitting || !expTitle.trim() || !expAmount} style={S.primaryBtn}>
                {submitting ? 'Saving…' : editingExpense ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Code Modal */}
      {showGroupCode && selectedGroup && (
        <div style={S.overlay} onClick={() => setShowGroupCode(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalTitle}>Invite Code</div>
            <p style={{ color: '#666', fontSize: 14, marginBottom: 16 }}>
              Share this code to invite someone to <strong>{selectedGroup.name}</strong>.
            </p>
            <div style={{ background: '#f4f7f4', borderRadius: 16, padding: 24, textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 44, fontWeight: 900, letterSpacing: 12, color: '#22533e' }}>
                {selectedGroup.invite_code}
              </div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 8 }}>Permanent · Only admin can reset</div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <button onClick={copyCode} style={{ ...S.cancelBtn, flex: 1 }}>📋 Copy Code</button>
              <button onClick={refreshCode} style={{ ...S.cancelBtn, flex: 1, color: '#c05621', borderColor: '#fed7aa' }}>🔄 New Code</button>
            </div>
            <button onClick={() => setShowGroupCode(false)} style={{ ...S.primaryBtn, width: '100%' }}>Done</button>
          </div>
        </div>
      )}

      {showNotifs && <NotifsDrawer notifications={notifications} onClose={() => setShowNotifs(false)} />}
      {toast && <Toast message={toast} onDone={() => setToast('')} />}
    </div>
  );
}

function NotifsDrawer({ notifications, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, padding: '20px 16px 36px', maxHeight: '70vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Notifications</div>
        {notifications.length === 0
          ? <div style={{ color: '#888', fontSize: 14, textAlign: 'center', padding: '30px 0' }}>No notifications yet</div>
          : notifications.map(n => (
            <div key={n.id} style={{ padding: '10px 0', borderBottom: '1px solid #f0f0f0', fontSize: 14, color: n.read ? '#888' : '#1a1a1a', fontWeight: n.read ? 400 : 600 }}>
              <div>{n.message}</div>
              <div style={{ fontSize: 11, color: '#bbb', marginTop: 3 }}>{new Date(n.created_at).toLocaleString('en-IN')}</div>
            </div>
          ))
        }
      </div>
    </div>
  );
}

const S = {
  app:         { minHeight: '100vh', background: '#f4f7f4', fontFamily: 'system-ui,-apple-system,sans-serif', display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto', position: 'relative' },
  header:      { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#fff', borderBottom: '1px solid #eee', position: 'sticky', top: 0, zIndex: 10 },
  logoBadge:   { width: 36, height: 36, borderRadius: 10, background: '#22533e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, flexShrink: 0 },
  logoutBtn:   { border: '1px solid #ddd', background: '#fff', borderRadius: 8, padding: '5px 10px', fontSize: 12, cursor: 'pointer', color: '#555', fontWeight: 600 },
  iconBtn:     { border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', padding: 4, position: 'relative' },
  badge:       { position: 'absolute', top: 0, right: 0, background: '#e53e3e', color: '#fff', borderRadius: '50%', width: 16, height: 16, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 },
  backBtn:     { border: 'none', background: 'none', color: '#22533e', fontSize: 17, fontWeight: 700, cursor: 'pointer', padding: '4px 8px', flexShrink: 0 },
  fab:         { position: 'fixed', bottom: 24, right: 24, width: 58, height: 58, borderRadius: '50%', background: '#22533e', color: '#fff', fontSize: 32, border: 'none', cursor: 'pointer', boxShadow: '0 4px 16px rgba(34,83,62,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, fontWeight: 300 },
  emptyState:  { textAlign: 'center', padding: '80px 20px', color: '#888' },
  groupCard:   { display: 'flex', alignItems: 'center', gap: 14, background: '#fff', borderRadius: 16, padding: '14px 16px', marginBottom: 10, cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #eee' },
  groupIconBox:{ width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 },
  bannerCard:  { background: 'linear-gradient(135deg,#22533e,#2d7a57)', borderRadius: 20, padding: 20, color: '#fff', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  section:     { background: '#fff', borderRadius: 16, padding: 16, marginBottom: 14, border: '1px solid #eee' },
  sectionTitle:{ fontWeight: 700, fontSize: 15, color: '#1a1a1a', marginBottom: 0 },
  expenseRow:  { display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 0', borderBottom: '1px solid #f5f5f5' },
  miniBtn:     { fontSize: 12, padding: '3px 8px', border: '1px solid #ddd', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#555', fontWeight: 600 },
  addBtn:      { background: '#22533e', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 16px', fontWeight: 700, fontSize: 14, cursor: 'pointer' },
  tag:         { background: '#e8f5e9', color: '#22533e', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 },
  overlay:     { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100 },
  sheet:       { background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480 },
  modal:       { background: '#fff', borderRadius: 20, width: 'calc(100% - 32px)', maxWidth: 440, padding: '24px 20px', margin: '0 16px 40px', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' },
  modalTitle:  { fontWeight: 800, fontSize: 18, color: '#1a1a1a', marginBottom: 16 },
  sheetBtn:    { display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '14px 16px', background: '#f4f7f4', border: 'none', borderRadius: 14, cursor: 'pointer', marginBottom: 10, textAlign: 'left' },
  label:       { display: 'block', fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 6, marginTop: 14 },
  input:       { width: '100%', padding: '11px 12px', borderRadius: 10, border: '1.5px solid #ddd', fontSize: 15, boxSizing: 'border-box', outline: 'none', marginBottom: 2, fontFamily: 'inherit' },
  chipRow:     { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip:        { padding: '7px 14px', borderRadius: 999, border: '1.5px solid #ddd', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#555' },
  chipActive:  { background: '#e8f5e9', borderColor: '#22533e', color: '#22533e' },
  primaryBtn:  { flex: 1, padding: 12, background: '#22533e', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: 'pointer' },
  cancelBtn:   { flex: 1, padding: 12, background: '#fff', color: '#333', border: '1.5px solid #ddd', borderRadius: 12, fontWeight: 600, fontSize: 15, cursor: 'pointer' },
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>
);