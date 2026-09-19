import { Lock, Key, Settings, Fingerprint, CheckCircle2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useVault } from '../../lib/VaultContext';
import { supabase } from '../../lib/supabase';
import { useState, useEffect } from 'react';

export default function VaultDashboard() {
  const { lockVault, vaultKey } = useVault();
  const navigate = useNavigate();
  const [webAuthnSupported, setWebAuthnSupported] = useState(false);
  const [hasBiometric, setHasBiometric] = useState(false);
  const [setupStatus, setSetupStatus] = useState('');

  useEffect(() => {
    setWebAuthnSupported(!!(window.PublicKeyCredential && navigator.credentials));
    const checkBio = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && localStorage.getItem(`vault_bio_key_${user.id}`)) {
         setHasBiometric(true);
      }
    };
    checkBio();
  }, []);

  const handleSetupBiometric = async () => {
    setSetupStatus('Prompting device verification...');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      if (!vaultKey) throw new Error('Vault is locked. No key in memory.');
      
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: { name: "To-Do List Vault", id: window.location.hostname },
          user: {
            id: new TextEncoder().encode(user.id),
            name: user.email || 'user',
            displayName: 'To-Do List User',
          },
          pubKeyCredParams: [{ type: "public-key", alg: -7 }],
          timeout: 60000,
          authenticatorSelection: { userVerification: "required" }
        }
      }) as PublicKeyCredential;

      if (credential) {
         // Export the current vault key to raw to store in localStorage
         const exported = await crypto.subtle.exportKey('raw', vaultKey);
         const base64Key = btoa(String.fromCharCode(...new Uint8Array(exported)));
         const base64Id = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
         
         localStorage.setItem(`vault_bio_key_${user.id}`, base64Key);
         localStorage.setItem(`vault_bio_id_${user.id}`, base64Id);
         setHasBiometric(true);
         setSetupStatus('Device authentication enabled!');
         setTimeout(() => setSetupStatus(''), 3000);
      }
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
         setSetupStatus('Verification cancelled.');
      } else {
         setSetupStatus('Failed tracking passkey: ' + (err.message || 'Unknown error'));
      }
      setTimeout(() => setSetupStatus(''), 3000);
    }
  };

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
      
      {/* Biometric Passkey Setup */}
      {webAuthnSupported && (
        <div className="glass-card p-5 border-primary-200/30">
           <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
             <div>
               <h3 className="font-semibold text-primary-800 text-sm mb-1 flex items-center gap-2">
                 <Fingerprint className="w-4 h-4 text-primary-600" />
                 Device Biometric / Passkey
               </h3>
               <p className="text-xs text-primary-600 max-w-sm">
                 Enable local device authentication to unlock your vault using Face ID, Touch ID, or your device Passkey securely.
               </p>
             </div>
             
             {hasBiometric ? (
               <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                 <CheckCircle2 className="w-4 h-4" />
                 <span className="text-sm font-medium">Enabled</span>
               </div>
             ) : (
               <button onClick={handleSetupBiometric} className="glass-btn px-4 py-2 text-sm shrink-0">
                 Enable
               </button>
             )}
           </div>
           
           {setupStatus && (
              <p className="text-xs font-semibold text-primary-600 mt-3 animate-fade-in">{setupStatus}</p>
           )}
        </div>
      )}

      <div className="glass-card p-5 border-primary-200/30">
        <h3 className="font-semibold text-primary-800 text-sm mb-2">Security Note</h3>
        <p className="text-xs text-primary-600 leading-relaxed">
          Your vault uses client-side AES-256-GCM encryption. Data is encrypted on your device before being stored. Without your Vault PIN (or verified Passkey device), it is mathematically impossible to read your data.
        </p>
      </div>
    </div>
  );
}
