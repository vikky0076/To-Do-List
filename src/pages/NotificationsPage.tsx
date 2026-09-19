import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  Bell, BellOff, Check, Trash2, Settings as SettingsIcon, Info
} from 'lucide-react';
import {
  requestNotificationPermission, getPermissionStatus,
  getNotificationSupport, sendNotification
} from '../lib/notifications';

type AppNotification = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [permStatus, setPermStatus] = useState(getPermissionStatus());
  const [showSettings, setShowSettings] = useState(false);
  const notifSupport = getNotificationSupport();

  // Notification prefs
  const [prefs, setPrefs] = useState({
    event_reminders: true,
    daily_reminders: true,
    task_completion: true,
    reward_notifications: true,
    streak_notifications: true,
    default_reminder_minutes: 30,
  });

  useEffect(() => {
    fetchNotifications();
    fetchPrefs();
  }, []);

  const getUserId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id;
  };

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const userId = await getUserId();
      if (!userId) return;
      const { data, error } = await supabase
        .from('app_notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) {
        // Table may not exist yet, we handle gracefully
        console.warn('app_notifications fetch:', error.message);
        setNotifications([]);
        return;
      }
      setNotifications(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchPrefs = async () => {
    try {
      const userId = await getUserId();
      if (!userId) return;
      const { data } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();
      if (data) {
        setPrefs(prev => ({ ...prev, ...data }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const updatePref = async (key: string, value: boolean | number) => {
    setPrefs(prev => ({ ...prev, [key]: value }));
    try {
      const userId = await getUserId();
      if (!userId) return;
      await supabase
        .from('notification_preferences')
        .upsert({ user_id: userId, [key]: value }, { onConflict: 'user_id' });
    } catch (e) {
      console.error(e);
    }
  };

  const markAsRead = async (id: string) => {
    setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
    try {
      await supabase.from('app_notifications').update({ read: true }).eq('id', id);
    } catch (e) {
      console.error(e);
    }
  };

  const deleteNotification = async (id: string) => {
    setNotifications(notifications.filter(n => n.id !== id));
    try {
      await supabase.from('app_notifications').delete().eq('id', id);
    } catch (e) {
      console.error(e);
    }
  };

  const markAllRead = async () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
    try {
      const userId = await getUserId();
      if (!userId) return;
      await supabase.from('app_notifications').update({ read: true }).eq('user_id', userId);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRequestPermission = async () => {
    const result = await requestNotificationPermission();
    setPermStatus(result);
    if (result === 'granted') {
      sendNotification('Notifications Enabled! 🎉', {
        body: 'You will now receive reminders for your events.',
      });
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="space-y-6 pb-20 animate-fade-in-up">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary-900">Notifications</h1>
          <p className="text-primary-500 text-sm mt-0.5">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="glass-btn-secondary px-3 py-1.5 text-xs">
              <Check className="w-3.5 h-3.5" /> Mark all read
            </button>
          )}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-primary-100 text-primary-600' : 'text-gray-500 hover:bg-white/50'}`}
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Permission Banner */}
      {permStatus !== 'granted' && notifSupport.supported && (
        <div className="glass-card-solid p-4 flex items-start gap-3">
          <BellOff className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-800">Enable Notifications</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {permStatus === 'denied'
                ? 'Notifications are blocked. Please enable them in your browser settings (click the lock icon in the address bar).'
                : 'Allow notifications to receive event reminders and task alerts.'
              }
            </p>
            {permStatus !== 'denied' && (
              <button
                onClick={handleRequestPermission}
                className="glass-btn px-3 py-1.5 text-xs mt-2"
              >
                <Bell className="w-3.5 h-3.5" /> Allow Notifications
              </button>
            )}
          </div>
        </div>
      )}

      {!notifSupport.supported && (
        <div className="glass-card-solid p-4 flex items-start gap-3 border-amber-200">
          <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">Browser Not Supported</p>
            <p className="text-xs text-amber-600 mt-0.5">{notifSupport.reason}</p>
          </div>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="glass-card-solid p-5 animate-scale-in space-y-4">
          <h3 className="font-semibold text-primary-800 text-sm">Notification Settings</h3>

          <TogglePref
            label="Event reminders"
            description="Get notified before events start."
            checked={prefs.event_reminders}
            onChange={v => updatePref('event_reminders', v)}
          />
          <TogglePref
            label="Daily reminders"
            description="Daily reminder to check your tasks."
            checked={prefs.daily_reminders}
            onChange={v => updatePref('daily_reminders', v)}
          />
          <TogglePref
            label="Task completion"
            description="Celebrate when you complete tasks."
            checked={prefs.task_completion}
            onChange={v => updatePref('task_completion', v)}
          />
          <TogglePref
            label="Reward notifications"
            description="Get notified when you unlock rewards."
            checked={prefs.reward_notifications}
            onChange={v => updatePref('reward_notifications', v)}
          />
          <TogglePref
            label="Streak notifications"
            description="Keep your streak alive."
            checked={prefs.streak_notifications}
            onChange={v => updatePref('streak_notifications', v)}
          />

          <div className="pt-2 border-t border-white/30">
            <label className="block text-xs font-medium text-primary-700 mb-1">Default Reminder Time</label>
            <select
              value={prefs.default_reminder_minutes}
              onChange={e => updatePref('default_reminder_minutes', Number(e.target.value))}
              className="glass-input text-sm"
            >
              <option value={5}>5 minutes before</option>
              <option value={15}>15 minutes before</option>
              <option value={30}>30 minutes before</option>
              <option value={60}>1 hour before</option>
              <option value={1440}>1 day before</option>
            </select>
          </div>
        </div>
      )}

      {/* Notification List */}
      {loading ? (
        <div className="text-center py-12 text-primary-400 text-sm">Loading…</div>
      ) : notifications.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Bell className="w-10 h-10 text-primary-300 mx-auto mb-3" />
          <p className="text-primary-500 text-sm">No notifications yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(notif => (
            <div
              key={notif.id}
              className={`glass-card p-3.5 flex items-start gap-3 transition-all ${notif.read ? 'opacity-60' : ''}`}
            >
              <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${notif.read ? 'bg-gray-300' : 'bg-primary-500'}`} />
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-gray-800 text-sm">{notif.title}</h4>
                <p className="text-xs text-gray-500 mt-0.5">{notif.body}</p>
                <span className="text-[0.65rem] text-gray-400 mt-1 block">
                  {new Date(notif.created_at).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {!notif.read && (
                  <button
                    onClick={() => markAsRead(notif.id)}
                    className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                    title="Mark read"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => deleteNotification(notif.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TogglePref({ label, description, checked, onChange }: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <div
        className={`toggle-switch ${checked ? 'active' : ''}`}
        onClick={() => onChange(!checked)}
      />
    </div>
  );
}
