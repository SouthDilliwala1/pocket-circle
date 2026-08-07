import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const initialGroups = [
  {
    id: 'home', name: 'Bansal Home', type: 'Household', emoji: '🏠', total: 18840,
    members: [
      { id: 'dad', name: 'Rakesh', initials: 'R', color: '#dae9db' },
      { id: 'mom', name: 'Sunita', initials: 'S', color: '#f4dfcb' },
      { id: 'me', name: 'Arnav', initials: 'A', color: '#dce4f5' },
    ],
    expenses: [
      { id: '1', person: 'dad', amount: 4860, category: 'Groceries', description: 'Monthly groceries from Reliance Fresh', method: 'UPI', date: 'Today, 10:42 AM', split: 'Shared with 3 people' },
      { id: '2', person: 'mom', amount: 1200, category: 'Medicine', description: 'Medicine from Apollo', method: 'Cash', date: 'Yesterday, 6:15 PM', split: 'Only Sunita' },
      { id: '3', person: 'me', amount: 520, category: 'Fuel', description: 'Petrol', method: 'Credit card', date: 'Yesterday, 9:03 AM', split: 'Only Arnav' },
    ]
  },
  {
    id: 'goa', name: 'Goa Trip 2026', type: 'Trip', emoji: '🌴', total: 24650,
    members: [
      { id: 'me', name: 'Arnav', initials: 'A', color: '#dce4f5' },
      { id: 'rahul', name: 'Rahul', initials: 'R', color: '#f8dfda' },
      { id: 'neha', name: 'Neha', initials: 'N', color: '#e6ddf5' },
    ],
    expenses: [
      { id: '4', person: 'rahul', amount: 6800, category: 'Travel', description: 'Hotel booking', method: 'UPI', date: 'Aug 2, 4:20 PM', split: 'Shared with 3 people' },
    ]
  }
];

const categories = ['Groceries', 'Rent', 'Bills', 'Fuel', 'Medicine', 'Dining', 'Travel', 'Shopping', 'Entertainment', 'Education', 'Other'];
const methods = ['Cash', 'UPI', 'Credit card', 'Debit card', 'Bank transfer'];
const splitOptions = {
  self: 'Only payer',
  equal: 'Shared equally',
  exact: 'Exact amounts',
  percentage: 'Percentage split',
  shares: 'Share units',
};
const money = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);

function Avatar({ person, size = '' }) { return <span className={`avatar ${size}`} style={{ background: person.color }}>{person.initials}</span>; }

function App() {
  const [groups, setGroups] = useState(() => JSON.parse(localStorage.getItem('pc-groups')) || initialGroups);
  const [activeGroupId, setActiveGroupId] = useState(() => localStorage.getItem('pc-active') || 'home');
  const [selectedMember, setSelectedMember] = useState(null);
  const [modal, setModal] = useState(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [mobileScreen, setMobileScreen] = useState('groups');
  const activeGroup = groups.find((group) => group.id === activeGroupId) || groups[0];

  useEffect(() => { localStorage.setItem('pc-groups', JSON.stringify(groups)); }, [groups]);
  useEffect(() => { localStorage.setItem('pc-active', activeGroupId); }, [activeGroupId]);
  useEffect(() => {
    const up = () => setOnline(true); const down = () => setOnline(false);
    window.addEventListener('online', up); window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);
  useEffect(() => {
    const savePrompt = (event) => { event.preventDefault(); setInstallPrompt(event); };
    window.addEventListener('beforeinstallprompt', savePrompt);
    return () => window.removeEventListener('beforeinstallprompt', savePrompt);
  }, []);

  const visibleExpenses = useMemo(() => selectedMember ? activeGroup.expenses.filter((expense) => expense.person === selectedMember) : activeGroup.expenses, [activeGroup, selectedMember]);
  const selected = activeGroup.members.find((member) => member.id === selectedMember);

  function addGroup(event) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    const name = data.get('name').trim(); if (!name) return;
    const group = { id: crypto.randomUUID(), name, type: data.get('type'), emoji: data.get('type') === 'Trip' ? '🧳' : '🏠', total: 0, members: [{ id: 'me', name: 'You', initials: 'Y', color: '#dce4f5' }], expenses: [] };
    setGroups((items) => [...items, group]); setActiveGroupId(group.id); setSelectedMember(null); setMobileScreen('group'); setModal(null);
  }
  function addExpense(event) {
    event.preventDefault(); const data = new FormData(event.currentTarget); const amount = Number(data.get('amount'));
    if (!amount) return;
    const chosenCategory = data.get('customCategory').trim() || data.get('category');
    const expenseDate = data.get('dateTime') ? new Date(data.get('dateTime')).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : 'Just now';
    const split = data.get('split');
    const receiptFiles = [...event.currentTarget.elements.receipts.files];
    if (receiptFiles.length > 5) { window.alert('Please add no more than 5 receipt photos.'); return; }
    if (receiptFiles.some((file) => file.size > 5 * 1024 * 1024)) { window.alert('Each receipt photo must be 5 MB or smaller.'); return; }
    const receipts = receiptFiles.length;
    const expense = { id: crypto.randomUUID(), person: data.get('person'), amount, category: chosenCategory, description: data.get('description') || chosenCategory, method: data.get('method'), date: expenseDate, split: split === 'self' ? `Only ${activeGroup.members.find(m => m.id === data.get('person')).name}` : `${splitOptions[split]} · ${activeGroup.members.length} people`, pending: !online, receipts };
    setGroups((items) => items.map((group) => group.id === activeGroup.id ? { ...group, total: group.total + amount, expenses: [expense, ...group.expenses] } : group)); setModal(null);
  }
  async function installApp() {
    if (installPrompt) { installPrompt.prompt(); await installPrompt.userChoice; setInstallPrompt(null); return; }
    setModal('install');
  }

  return <main className="app-shell">
    <header className="topbar"><div className="brand-mark">P</div><div><strong>PocketCircle</strong><small>Shared expenses, made simple</small></div><button className="quiet-button" onClick={() => setModal('help')}>?</button></header>
    {!online && <div className="sync-banner">Offline · new expenses will show “Waiting to sync”</div>}
    <div className={`content mobile-${mobileScreen}`}>
      <aside className="groups-panel">
        <div className="section-title"><span>Your groups</span><button className="round-plus" onClick={() => setModal('group')} aria-label="Create group">+</button></div>
        {groups.map((group) => <button key={group.id} className={`group-item ${group.id === activeGroup.id ? 'active' : ''}`} onClick={() => { setActiveGroupId(group.id); setSelectedMember(null); setMobileScreen('group'); }}><span className="group-icon">{group.emoji}</span><span>{group.name}<small>{group.type} · {group.members.length} member{group.members.length !== 1 ? 's' : ''}</small></span></button>)}
        <button className="install-link" onClick={installApp}>⊕ Add PocketCircle to phone</button>
      </aside>
      <section className="group-view">
        <div className="mobile-back-row"><button className="back-button" onClick={() => setMobileScreen('groups')}>← All groups</button></div>
        <div className="group-heading"><div><p className="eyebrow">{activeGroup.type}</p><h1>{activeGroup.name}</h1><p className="subtle">Every expense is visible to this group.</p></div><button className="primary-button" onClick={() => setModal('expense')}><span>+</span> Add expense</button></div>
        <div className="summary-card"><div><span>Total expenses</span><strong>{money(activeGroup.total)}</strong></div><div className="summary-note">This group<br />{activeGroup.expenses.length} expense{activeGroup.expenses.length !== 1 ? 's' : ''} recorded</div></div>
        <div className="members-expenses">
          <aside className="members-panel"><div className="section-title"><span>Members</span><small>{activeGroup.members.length}/11</small></div>{activeGroup.members.map((member) => <button key={member.id} className={`member-row ${selectedMember === member.id ? 'selected' : ''}`} onClick={() => setSelectedMember(selectedMember === member.id ? null : member.id)}><Avatar person={member}/><span>{member.name}<small>{money(activeGroup.expenses.filter(e => e.person === member.id).reduce((sum, e) => sum + e.amount, 0))}</small></span></button>)}</aside>
          <section className="expense-panel"><div className="expense-title"><div><h2>{selected ? `${selected.name}'s expenses` : 'All expenses'}</h2><p>{selected ? 'Tap the member again to see everyone.' : 'Newest expenses appear first.'}</p></div>{selected && <button className="text-button" onClick={() => setSelectedMember(null)}>Show all</button>}</div>{visibleExpenses.length ? <div className="expense-list">{visibleExpenses.map((expense) => { const person = activeGroup.members.find(m => m.id === expense.person); return <article className="expense-row" key={expense.id}><Avatar person={person} size="small"/><div className="expense-copy"><strong>{expense.description}</strong><span>{person.name} · {expense.category} · {expense.method}</span><span>{expense.date} {expense.pending && <em>Waiting to sync</em>} {expense.receipts ? <em className="receipt-count">📎 {expense.receipts} receipt{expense.receipts > 1 ? 's' : ''}</em> : null}</span></div><div className="expense-amount"><strong>{money(expense.amount)}</strong><span>{expense.split}</span></div></article>; })}</div> : <div className="empty-state">No expenses yet.<br /><button className="text-button" onClick={() => setModal('expense')}>Add the first one</button></div>}</section>
        </div>
      </section>
    </div>
    {modal === 'group' && <Modal title="Create a group" onClose={() => setModal(null)}><form onSubmit={addGroup} className="form"><label>Group name<input name="name" placeholder="For example, Bansal Home" autoFocus /></label><label>Group type<select name="type"><option>Household</option><option>Trip</option></select></label><p className="form-note">You become the only admin. You can later invite up to 10 members.</p><button className="primary-button">Create group</button></form></Modal>}
    {modal === 'expense' && <Modal title="Add expense" onClose={() => setModal(null)}><form onSubmit={addExpense} className="form expense-form"><label>Amount (₹)<input type="number" min="1" name="amount" placeholder="0" autoFocus required /></label><label>Paid by<select name="person">{activeGroup.members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label><label>Spent on<div className="capsules">{categories.map((category, i) => <label className="capsule" key={category}><input type="radio" name="category" value={category} defaultChecked={i === 0}/><span>{category}</span></label>)}</div><input name="customCategory" placeholder="Or type a custom category" /></label><label>Description <input name="description" placeholder="For example, vegetables and fruit" /></label><label>Payment method<div className="capsules">{methods.map((method, i) => <label className="capsule" key={method}><input type="radio" name="method" value={method} defaultChecked={i === 1}/><span>{method}</span></label>)}</div></label><label>Split method<div className="capsules">{Object.entries(splitOptions).map(([value, label], i) => <label className="capsule" key={value}><input type="radio" name="split" value={value} defaultChecked={i === 0}/><span>{label}</span></label>)}</div></label><label>Expense date and time <input type="datetime-local" name="dateTime" /></label><label>Receipt photos <input type="file" name="receipts" accept="image/*" multiple /><small className="input-note">Optional · up to 5 photos, 5 MB each</small></label><button className="primary-button">Save expense</button></form></Modal>}
    {modal === 'help' && <Modal title="PocketCircle is easy" onClose={() => setModal(null)}><div className="help"><div><b>1</b><span><strong>Create or open a group</strong><small>Use one group for your home and another for a trip.</small></span></div><div><b>2</b><span><strong>Tap “Add expense”</strong><small>Choose the person, amount, category, payment method, and a short description.</small></span></div><div><b>3</b><span><strong>Everything stays clear</strong><small>Tap a member to see only their expenses. New offline entries wait safely to sync.</small></span></div></div></Modal>}
    {modal === 'install' && <Modal title="Add to your phone" onClose={() => setModal(null)}><div className="install-help"><strong>Android</strong><p>Open PocketCircle in Chrome, tap the menu (⋮), then choose <b>Install app</b> or <b>Add to Home screen</b>.</p><strong>iPhone</strong><p>Open it in Safari, tap Share, then choose <b>Add to Home Screen</b>.</p></div></Modal>}
  </main>;
}

function Modal({ title, children, onClose }) { return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className="modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}><div className="modal-heading"><h2>{title}</h2><button className="quiet-button" onClick={onClose}>×</button></div>{children}</section></div>; }

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
createRoot(document.getElementById('root')).render(<App />);
