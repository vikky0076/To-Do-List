import { ListChecks, CalendarDays, Bell, Shield } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useState } from 'react';

export default function LandingPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setError('Account created! You can now sign in.');
        setIsLogin(true);
      }
    } catch (err: any) {
      if (err.message === 'Invalid login credentials') {
        setError('Invalid credentials. Create an account first.');
      } else {
        setError(err.message || 'An error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row" style={{ background: 'linear-gradient(135deg, #e8dff5 0%, #d4c5f0 30%, #c9b8ec 60%, #e0d5f5 100%)' }}>
      {/* Left Hero */}
      <div className="flex-1 p-8 md:p-16 flex flex-col justify-center">
        <div className="max-w-xl mx-auto md:mx-0">
          <div className="flex items-center space-x-3 mb-8">
            <div className="w-11 h-11 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-primary-400/30">
              ✓
            </div>
            <h1 className="text-xl font-bold text-primary-900">TO-DO LIST</h1>
          </div>

          <h2 className="text-4xl md:text-5xl font-bold text-primary-900 leading-tight mb-6">
            Organize your day.<br />
            Track your progress.<br />
            <span className="bg-gradient-to-r from-primary-500 to-primary-700 bg-clip-text text-transparent">
              Achieve more.
            </span>
          </h2>

          <p className="text-base text-primary-700/70 mb-10 leading-relaxed">
            A complete personal productivity system designed to help you focus, stay on track, and get your work done.
          </p>

          <div className="space-y-3">
            <FeatureItem icon={<ListChecks />} text="Daily To-Do Lists & Checklists" />
            <FeatureItem icon={<CalendarDays />} text="Event Scheduling & Reminders" />
            <FeatureItem icon={<Bell />} text="Real Browser Notifications" />
            <FeatureItem icon={<Shield />} text="Private Encrypted Vault" />
          </div>
        </div>
      </div>

      {/* Right Auth */}
      <div className="w-full md:w-[420px] flex items-center justify-center p-6 md:p-8">
        <div className="w-full max-w-sm glass-card-solid p-7">
          <h3 className="text-xl font-bold text-primary-900 mb-1">
            {isLogin ? 'Welcome back' : 'Create an account'}
          </h3>
          <p className="text-sm text-primary-500 mb-5">
            {isLogin ? 'Sign in to continue.' : 'Start your productivity journey.'}
          </p>

          <form onSubmit={handleAuth} className="space-y-3">
            {error && (
              <div className={`p-3 text-sm rounded-xl ${error.includes('created') ? 'bg-emerald-50/80 text-emerald-600 border border-emerald-200' : 'bg-red-50/80 text-red-600 border border-red-200'}`}>
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-primary-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                className="glass-input"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-primary-700 mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                className="glass-input"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full glass-btn justify-center py-2.5"
            >
              {loading ? 'Please wait…' : (isLogin ? 'Sign In' : 'Create Account')}
            </button>
          </form>

          <div className="mt-4 flex items-center">
            <div className="flex-grow border-t border-white/30" />
            <span className="mx-3 text-xs text-primary-400">or</span>
            <div className="flex-grow border-t border-white/30" />
          </div>

          <button
            onClick={async () => {
              setLoading(true);
              const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
              if (error) { setError(error.message); setLoading(false); }
            }}
            disabled={loading}
            className="w-full mt-3 glass-btn-secondary justify-center py-2.5"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            <span>Continue with Google</span>
          </button>

          <div className="mt-5 text-center text-sm text-primary-600">
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => { setIsLogin(!isLogin); setError(null); }}
              className="text-primary-700 font-semibold hover:underline"
            >
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureItem({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center space-x-3 text-primary-700">
      <div className="glass-card p-2 text-primary-500">{icon}</div>
      <span className="font-medium text-sm">{text}</span>
    </div>
  );
}
