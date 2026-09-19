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
import { supabase, isSupabaseConfigured } from './lib/supabase';
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
  
  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white border-2 border-red-500 rounded-xl p-8 max-w-2xl w-full shadow-2xl space-y-6">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 text-2xl font-bold">!</div>
            <h1 className="text-2xl font-bold text-gray-900">Missing Vercel Environment Variables</h1>
          </div>
          <div className="space-y-4 text-gray-700">
            <p>Your deployed application could not connect to Supabase because the Environment Variables are missing or incorrectly named inside Vercel.</p>
            <div className="bg-gray-100 p-4 rounded-lg font-mono text-sm space-y-2">
              <p><span className="font-bold text-red-600">Ensure EXACT Spelling in Vercel:</span></p>
              <p>Key 1: <strong>VITE_SUPABASE_URL</strong></p>
              <p>Key 2: <strong>VITE_SUPABASE_ANON_KEY</strong></p>
            </div>
            <ul className="list-disc pl-5 space-y-2 text-sm">
              <li>Open your Vercel Dashboard Settings -&gt; Environment Variables.</li>
              <li>Make sure the prefix <span className="font-semibold bg-yellow-100">VITE_</span> is included in the name! (If it says SUPABASE_URL, it will fail).</li>
              <li>Ensure the boxes for <span className="font-semibold">Production</span>, <span className="font-semibold">Preview</span>, and <span className="font-semibold">Development</span> environments are all checked.</li>
              <li><strong>Crucial:</strong> After making these changes, you <span className="underline font-bold">must Redeemer/Rebuild the app</span> in Vercel.</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

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
