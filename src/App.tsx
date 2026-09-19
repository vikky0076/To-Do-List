import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import TodayPage from './pages/TodayPage';
import UpcomingEventsPage from './pages/UpcomingEventsPage';
import NotificationsPage from './pages/NotificationsPage';
import ProfilePage from './pages/ProfilePage';
import MainLayout from './layouts/MainLayout';
import VaultGate from './pages/vault/VaultGate';
import VaultDashboard from './pages/vault/VaultDashboard';
import VaultPasswords from './pages/vault/VaultPasswords';
import Settings from './pages/Settings';
import { supabase } from './lib/supabase';
import type { User } from '@supabase/supabase-js';
import { VaultProvider } from './lib/VaultContext';
import { UserProvider } from './lib/UserContext';

function SplashScreen() {
  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #e8dff5 0%, #d4c5f0 30%, #c9b8ec 60%, #e0d5f5 100%)' }}
    >
      <div className="glass-card-solid p-6 flex flex-col items-center space-y-4 animate-scale-in">
        <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-primary-400/30">
          ✓
        </div>
        <h1 className="text-2xl font-bold text-primary-900 tracking-tight">TO-DO LIST</h1>
      </div>
    </div>
  );
}

function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setTimeout(() => setLoading(false), 1200);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Register service worker for PWA
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Service worker registration failed — notifications will be tab-only
      });
    }
  }, []);

  if (loading) return <SplashScreen />;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={!user ? <LandingPage /> : <Navigate to="/dashboard" replace />} />

        {/* Protected Routes */}
        <Route element={user ? <UserProvider><VaultProvider><MainLayout /></VaultProvider></UserProvider> : <Navigate to="/" replace />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/today" element={<TodayPage />} />
          <Route path="/upcoming" element={<UpcomingEventsPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/profile" element={<ProfilePage />} />

          {/* Private Vault */}
          <Route path="/vault" element={<VaultGate />}>
            <Route index element={<Navigate to="/vault/dashboard" replace />} />
            <Route path="dashboard" element={<VaultDashboard />} />
            <Route path="passwords" element={<VaultPasswords />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
