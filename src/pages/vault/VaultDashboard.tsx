import { Lock, Key, Settings } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useVault } from '../../lib/VaultContext';

export default function VaultDashboard() {
  const { lockVault } = useVault();
  const navigate = useNavigate();

  return (
    <div className="space-y-6 max-w-3xl mx-auto animate-fade-in-up">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary-900 flex items-center gap-2">
            <Lock className="w-6 h-6 text-primary-600" /> Private Vault
          </h1>
          <p className="text-primary-500 text-sm mt-0.5">Your encrypted personal information.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/settings')}
            className="p-2 text-primary-500 hover:bg-white/50 rounded-lg transition-colors"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
          <button
            onClick={lockVault}
            className="glass-btn-secondary px-3 py-2 text-sm"
          >
            <Lock className="w-4 h-4" /> Lock
          </button>
        </div>
      </header>

      {/* Main CTA — Passwords/Secrets */}
      <Link
        to="/vault/passwords"
        className="glass-card-solid p-6 flex items-center gap-4 hover:shadow-lg transition-all duration-200 group block"
      >
        <div className="p-3 rounded-xl bg-primary-100/60 group-hover:bg-primary-200/60 transition-colors">
          <Key className="w-6 h-6 text-primary-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-primary-800">Private Storage</h3>
          <p className="text-xs text-primary-500 mt-0.5">Store passwords, secrets, and private content.</p>
        </div>
        <span className="text-primary-600 text-sm font-medium">Open →</span>
      </Link>

      <div className="glass-card p-5 border-primary-200/30">
        <h3 className="font-semibold text-primary-800 text-sm mb-2">Security Note</h3>
        <p className="text-xs text-primary-600 leading-relaxed">
          Your vault uses client-side AES-256-GCM encryption. Data is encrypted on your device before being stored. Without your Vault PIN, it is mathematically impossible to read your data.
        </p>
      </div>
    </div>
  );
}
