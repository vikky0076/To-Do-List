import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useVault } from '../lib/VaultContext';
import type { User } from '@supabase/supabase-js';
import { User as UserIcon, Bell, Database, Shield, LogOut, Palette, FileText, Table } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { requestNotificationPermission, getPermissionStatus } from '../lib/notifications';
import { useUser } from '../lib/UserContext';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('account');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { lockVault } = useVault();
  const navigate = useNavigate();
  const { displayName: globalName, updateDisplayName } = useUser();

  // Profile
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Password
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Notification prefs
  const [prefs, setPrefs] = useState({
    event_reminders: true,
    daily_reminders: true,
    task_completion: true,
    reward_notifications: true,
    streak_notifications: true,
    default_reminder_minutes: 30,
  });

  const [showExportModal, setShowExportModal] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [globalName]);

  const loadSettings = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUser(user);
      setEmail(user.email || '');
      setDisplayName(globalName);

      const { data: prefData } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (prefData) setPrefs(prev => ({ ...prev, ...prefData }));
    }
    setLoading(false);
  };

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 5000);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (email !== user?.email) {
        const { error: emailError } = await supabase.auth.updateUser({ email });
        if (emailError) throw emailError;
        showMessage('Confirmation email sent to new address.', 'success');
      }
      
      if (displayName !== globalName) {
        const { success, error } = await updateDisplayName(displayName);
        if (!success) throw new Error(error || 'Failed to update name');
      }
      
      if (email === user?.email) showMessage('Profile updated successfully.', 'success');
    } catch (error: any) {
      showMessage(error.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) return showMessage('Passwords do not match.', 'error');
    if (newPassword.length < 6) return showMessage('Password must be at least 6 characters.', 'error');
    setIsSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      showMessage('Password changed.', 'success');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      showMessage(error.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdatePrefs = async (key: string, value: boolean | number) => {
    const updated = { ...prefs, [key]: value };
    setPrefs(updated);
    try {
      await supabase
        .from('notification_preferences')
        .upsert({ user_id: user?.id, [key]: value }, { onConflict: 'user_id' });
    } catch (e) {
      console.error(e);
    }
  };

  const handleSignOut = async () => {
    if (!window.confirm('Are you sure you want to log out?')) return;
    lockVault();
    await supabase.auth.signOut();
    navigate('/');
  };

  const exportData = async (format: 'csv' | 'pdf') => {
    const userId = user?.id;
    if (!userId) return;
    try {
      const { data: allTasks } = await supabase.from('tasks').select('*').eq('user_id', userId);
      const tasks = (allTasks || []).filter(t => t.priority !== 'Vault');
      const vaultItems = (allTasks || []).filter(t => t.priority === 'Vault');

      if (format === 'csv') {
          let csvContent = 'Type,Title,Status,Priority,Due Date,Points,Date Added\n';
          tasks.forEach(t => {
              const title = (t.title || '').replace(/"/g, '""');
              let type = 'Task';
              if (t.description?.includes('"type":"event"')) type = 'Event';
              else if (t.description?.includes('"type":"headline"')) type = 'List';
              const status = t.completed ? 'Completed' : 'Pending';
              csvContent += `"${type}","${title}","${status}","${t.priority || 'Medium'}","${t.due_date?.slice(0, 10) || ''}","${t.points || 0}","${t.created_at?.slice(0, 10) || ''}"\n`;
          });
          vaultItems.forEach(t => {
              csvContent += `"Vault Secret","[Encrypted Content]","Locked","Vault","","0","${t.created_at?.slice(0, 10) || ''}"\n`;
          });
          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `todolist-export-${new Date().toISOString().slice(0,10)}.csv`;
          a.click();
          URL.revokeObjectURL(url);
          showMessage('Data exported successfully as CSV.', 'success');
      } else if (format === 'pdf') {
          const doc = new jsPDF();
          doc.text("To-Do List & Vault Export", 14, 15);
          const tableData: any[][] = [];
          tasks.forEach(t => {
              let type = 'Task';
              if (t.description?.includes('"type":"event"')) type = 'Event';
              else if (t.description?.includes('"type":"headline"')) type = 'List';
              tableData.push([type, t.title || '', t.completed ? 'Completed' : 'Pending', t.priority || 'Medium', t.due_date?.slice(0, 10) || '']);
          });
          vaultItems.forEach(_ => {
              tableData.push(["Vault Secret", "[Encrypted Content]", "Locked", "Vault", ""]);
          });
          autoTable(doc, { head: [['Type', 'Title', 'Status', 'Priority', 'Due Date']], body: tableData, startY: 20 });
          doc.save(`todolist-export-${new Date().toISOString().slice(0,10)}.pdf`);
          showMessage('Data exported successfully as PDF.', 'success');
      }
    } catch (e) {
      console.error(e);
      showMessage('Export failed.', 'error');
    }
  };

  if (loading) return <div className="p-8 text-center text-primary-400">Loading settings…</div>;

  const tabs = [
    { id: 'account', label: 'Account', icon: UserIcon },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'data', label: 'Data & Privacy', icon: Database },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-20 animate-fade-in-up">
      <header>
        <h1 className="text-2xl font-bold text-primary-900">Settings</h1>
        <p className="text-primary-500 text-sm mt-0.5">Manage your account and preferences.</p>
      </header>

      {message.text && (
        <div className={`p-3 rounded-xl text-sm font-medium ${message.type === 'error' ? 'bg-red-50/80 text-red-600 border border-red-200' : 'bg-emerald-50/80 text-emerald-600 border border-emerald-200'}`}>
          {message.text}
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4 items-start">
        {/* Tabs */}
        <div className="w-full md:w-56 glass-card-solid p-1.5 shrink-0">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-primary-500/15 text-primary-700'
                  : 'text-gray-600 hover:bg-white/50'
              }`}
            >
              <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-primary-600' : 'text-gray-400'}`} />
              <span>{tab.label}</span>
            </button>
          ))}
          {/* Logout in settings sidebar */}
          <div className="border-t border-white/30 mt-1 pt-1">
            <button
              onClick={handleSignOut}
              className="w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 glass-card-solid p-5 w-full">

          {/* ACCOUNT */}
          {activeTab === 'account' && (
            <div className="space-y-6 animate-fade-in">
              <h3 className="font-semibold text-primary-800">Profile Information</h3>
              <form onSubmit={handleUpdateProfile} className="space-y-3 max-w-md">
                <div>
                  <label className="block text-xs font-medium text-primary-700 mb-1">Display Name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    className="glass-input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-primary-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="glass-input"
                  />
                </div>
                <button type="submit" disabled={isSaving} className="glass-btn px-5 py-2 text-sm">
                  {isSaving ? 'Saving…' : 'Save Profile'}
                </button>
              </form>
            </div>
          )}

          {/* SECURITY */}
          {activeTab === 'security' && (
            <div className="space-y-6 animate-fade-in">
              <h3 className="font-semibold text-primary-800">Change Password</h3>
              <form onSubmit={handleUpdatePassword} className="space-y-3 max-w-md">
                <div>
                  <label className="block text-xs font-medium text-primary-700 mb-1">New Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    className="glass-input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-primary-700 mb-1">Confirm Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    className="glass-input"
                  />
                </div>
                <button type="submit" disabled={isSaving} className="glass-btn px-5 py-2 text-sm">
                  Update Password
                </button>
              </form>
            </div>
          )}

          {/* NOTIFICATIONS */}
          {activeTab === 'notifications' && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="font-semibold text-primary-800">Notification Preferences</h3>
              <div className="space-y-3 max-w-md">
                <ToggleRow label="Event reminders" desc="Before events start" checked={prefs.event_reminders} onChange={v => handleUpdatePrefs('event_reminders', v)} />
                <ToggleRow label="Daily reminders" desc="Check your tasks" checked={prefs.daily_reminders} onChange={v => handleUpdatePrefs('daily_reminders', v)} />
                <ToggleRow label="Task completion" desc="Celebrate completions" checked={prefs.task_completion} onChange={v => handleUpdatePrefs('task_completion', v)} />
                <ToggleRow label="Reward notifications" desc="Unlock rewards" checked={prefs.reward_notifications} onChange={v => handleUpdatePrefs('reward_notifications', v)} />
                <ToggleRow label="Streak notifications" desc="Keep streaks alive" checked={prefs.streak_notifications} onChange={v => handleUpdatePrefs('streak_notifications', v)} />

                <div className="pt-2 border-t border-white/30">
                  <label className="block text-xs font-medium text-primary-700 mb-1">Default Reminder Time</label>
                  <select
                    value={prefs.default_reminder_minutes}
                    onChange={e => handleUpdatePrefs('default_reminder_minutes', Number(e.target.value))}
                    className="glass-input text-sm"
                  >
                    <option value={5}>5 minutes</option>
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={60}>1 hour</option>
                    <option value={1440}>1 day</option>
                  </select>
                </div>

                {getPermissionStatus() !== 'granted' && (
                  <button
                    onClick={async () => {
                      const r = await requestNotificationPermission();
                      if (r === 'granted') showMessage('Notifications enabled!', 'success');
                      else if (r === 'denied') showMessage('Notifications blocked. Enable in browser settings.', 'error');
                    }}
                    className="glass-btn px-4 py-2 text-sm mt-2"
                  >
                    <Bell className="w-4 h-4" /> Enable Browser Notifications
                  </button>
                )}
              </div>
            </div>
          )}

          {/* APPEARANCE */}
          {activeTab === 'appearance' && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="font-semibold text-primary-800">Appearance</h3>
              <p className="text-sm text-primary-500">Violet Glassmorphism theme is active. Additional theme options coming soon.</p>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-400 to-primary-700 border-2 border-primary-300" />
                <span className="text-sm font-medium text-primary-700">Violet Glass (Active)</span>
              </div>
            </div>
          )}

          {/* DATA & PRIVACY */}
          {activeTab === 'data' && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h3 className="font-semibold text-primary-800 mb-2">Export Data</h3>
                <p className="text-xs text-primary-500 mb-3">Download a copy of your tasks, events, and settings.</p>
                <button
                  onClick={() => setShowExportModal(true)}
                  className="glass-btn-secondary px-4 py-2 text-sm"
                >
                  Export My Data
                </button>
              </div>
              <div className="pt-4 border-t border-white/30">
                <h3 className="font-semibold text-red-600 mb-2">Danger Zone</h3>
                <p className="text-xs text-primary-500 mb-3">Permanently delete your account and all data. This cannot be undone.</p>
                <button
                  onClick={() => {
                    if (window.confirm('WARNING: This permanently deletes your account. Are you sure?')) {
                      alert('Account deletion requires backend admin API. Please contact support.');
                    }
                  }}
                  className="glass-btn-danger px-4 py-2 text-sm"
                >
                  Delete Account
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Export Format Modal */}
      {showExportModal && (
        <div className="modal-overlay z-50">
          <div className="modal-content animate-scale-in text-center p-6 border border-white/40">
            <h3 className="text-xl font-bold text-primary-900 mb-2">Export Format</h3>
            <p className="text-sm text-primary-600 mb-6 leading-relaxed">
              Choose your preferred export format. We recommend PDF for printing or CSV for spreadsheet applications.
            </p>
            <div className="space-y-3">
              <button 
                onClick={() => { setShowExportModal(false); exportData('pdf'); }} 
                className="w-full glass-btn justify-center py-2.5 flex items-center gap-2"
              >
                <FileText className="w-4 h-4" /> Download as PDF
              </button>
              <button 
                onClick={() => { setShowExportModal(false); exportData('csv'); }} 
                className="w-full glass-btn-secondary justify-center py-2.5 flex items-center gap-2"
              >
                <Table className="w-4 h-4" /> Download as CSV
              </button>
              <button 
                onClick={() => setShowExportModal(false)} 
                className="w-full text-center text-sm font-medium text-gray-500 py-2 hover:text-gray-700 mt-1 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function ToggleRow({ label, desc, checked, onChange }: {
  label: string; desc: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl hover:bg-white/30 transition-colors cursor-pointer" onClick={() => onChange(!checked)}>
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        <p className="text-xs text-gray-500">{desc}</p>
      </div>
      <div className={`toggle-switch ${checked ? 'active' : ''}`} />
    </div>
  );
}
