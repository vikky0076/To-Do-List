import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User, Mail, Calendar, Shield, Edit2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../lib/UserContext';

export default function ProfilePage() {
  const { user, displayName, updateDisplayName } = useUser();
  const [email, setEmail] = useState('');
  const [createdAt, setCreatedAt] = useState('');
  const [todayCount, setTodayCount] = useState(0);
  const [eventCount, setEventCount] = useState(0);
  const navigate = useNavigate();

  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(displayName);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    loadProfileStats();
  }, [user]);

  useEffect(() => {
    setEditName(displayName);
  }, [displayName]);

  const loadProfileStats = async () => {
    if (!user) return;

    setEmail(user.email || '');
    setCreatedAt(user.created_at ? new Date(user.created_at).toLocaleDateString() : '');

    const { data: tasks } = await supabase.from('tasks').select('id, description').eq('user_id', user.id);
    
    let tCount = 0;
    let eCount = 0;
    
    if (tasks) {
      tasks.forEach(t => {
        if (!t.description || t.description === 'today_task' || t.description.includes('"type":"today"') || t.description.includes('"type":"headline"')) {
          tCount++;
        } else if (t.description.includes('"type":"event"')) {
          eCount++;
        }
      });
    }

    setTodayCount(tCount);
    setEventCount(eCount);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) {
      showMessage('Display name cannot be empty', 'error');
      return;
    }

    setIsSaving(true);
    const { success, error } = await updateDisplayName(editName);
    
    if (success) {
      showMessage('Profile updated successfully', 'success');
      setIsEditing(false);
    } else {
      showMessage(error || 'Unable to update profile. Please try again.', 'error');
    }
    
    setIsSaving(false);
  };

  const handleCancel = () => {
    setEditName(displayName); // Restore original
    setIsEditing(false);
    setMessage({ text: '', type: '' });
  };

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    if (type === 'success') {
      setTimeout(() => setMessage({ text: '', type: '' }), 4000);
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-6 pb-20 animate-fade-in-up">
      <header>
        <h1 className="text-2xl font-bold text-primary-900">Profile</h1>
      </header>

      {message.text && (
        <div className={`p-3 rounded-xl text-sm font-medium animate-fade-in ${message.type === 'error' ? 'bg-red-50/80 text-red-600 border border-red-200' : 'bg-emerald-50/80 text-emerald-600 border border-emerald-200'}`}>
          {message.text}
        </div>
      )}

      {/* Avatar & Name */}
      <div className="glass-card-solid p-6 text-center transition-all duration-300 relative">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-400 to-primary-700 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary-500/20">
          <span className="text-3xl font-bold text-white uppercase">
            {displayName.charAt(0) || 'U'}
          </span>
        </div>

        {!isEditing ? (
          <div className="animate-fade-in">
            <h2 className="text-xl font-bold text-primary-900 capitalize">{displayName}</h2>
            <p className="text-primary-500 text-sm flex items-center justify-center gap-1 mt-1">
              <Mail className="w-3.5 h-3.5" /> {email}
            </p>
            <p className="text-primary-400 text-xs flex items-center justify-center gap-1 mt-1">
              <Calendar className="w-3 h-3" /> Joined {createdAt}
            </p>
            
            <button
               onClick={() => setIsEditing(true)}
               className="mt-4 glass-btn-secondary px-4 py-2 text-sm"
            >
              <Edit2 className="w-4 h-4" /> Edit Profile
            </button>
          </div>
        ) : (
          <form onSubmit={handleSave} className="animate-fade-in text-left max-w-sm mx-auto mt-4 px-2">
            <div className="mb-4">
              <label className="block text-xs font-medium text-primary-700 mb-1">Display Name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="glass-input text-center"
                placeholder="Enter your name"
                disabled={isSaving}
                autoFocus
              />
            </div>
            
            <div className="flex items-center justify-center gap-2">
              <button 
                type="button" 
                onClick={handleCancel}
                disabled={isSaving}
                className="glass-btn-secondary px-4 py-2 text-sm w-full justify-center"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={isSaving || !editName.trim()}
                className="glass-btn px-4 py-2 text-sm w-full justify-center"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold text-primary-700">{todayCount}</p>
          <p className="text-xs text-primary-500">Today Tasks</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold text-primary-700">{eventCount}</p>
          <p className="text-xs text-primary-500">Events</p>
        </div>
      </div>

      {/* Quick Links */}
      <div className="space-y-2">
        <button
          onClick={() => navigate('/settings')}
          className="w-full glass-card p-3.5 flex items-center gap-3 text-left hover:bg-white/60 transition-colors"
        >
          <User className="w-5 h-5 text-primary-500" />
          <span className="text-sm font-medium text-gray-800">Account Settings</span>
        </button>
        <button
          onClick={() => navigate('/vault')}
          className="w-full glass-card p-3.5 flex items-center gap-3 text-left hover:bg-white/60 transition-colors"
        >
          <Shield className="w-5 h-5 text-primary-500" />
          <span className="text-sm font-medium text-gray-800">Private Vault</span>
        </button>
      </div>
    </div>
  );
}
