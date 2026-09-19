import { useState, useEffect } from 'react';
import { useVault } from '../../lib/VaultContext';
import { supabase } from '../../lib/supabase';
import { Lock, Unlock, ShieldCheck, Fingerprint } from 'lucide-react';
import { deriveKey } from '../../lib/crypto';
import { Outlet, useNavigate } from 'react-router-dom';

export default function VaultGate() {
  const { isUnlocked, unlockVault } = useVault();
  const [pin, setPin] = useState('');
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const [webAuthnSupported, setWebAuthnSupported] = useState(false);
  const [hasBiometric, setHasBiometric] = useState(false);

  useEffect(() => {
    setWebAuthnSupported(!!(window.PublicKeyCredential && navigator.credentials));
    
    // Check if user has previously registered biometric for this browser
    const checkBiometric = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && localStorage.getItem(`vault_bio_key_${user.id}`) && localStorage.getItem(`vault_bio_id_${user.id}`)) {
         setHasBiometric(true);
      }
    };
    checkBiometric();

    const checkSettings = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('vault_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();
      if (data) {
        // Has settings, show unlock
      } else {
        setIsSettingUp(true);
      }
      setLoading(false);
    };
    checkSettings();
  }, []);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 6) { setError('PIN must be at least 6 characters'); return; }
    if (pin !== confirmPin) { setError('PINs do not match'); return; }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error: insertError } = await supabase
        .from('vault_settings')
        .insert({ user_id: user.id, auto_lock_minutes: 10 });
      if (insertError) throw insertError;
      const enc = new TextEncoder();
      const salt = enc.encode(user.id);
      const key = await deriveKey(pin, salt);
      unlockVault(key);
      navigate('/vault/dashboard');
    } catch (err: any) {
      setError(err.message || 'Setup failed');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const enc = new TextEncoder();
      const salt = enc.encode(user.id);
      const key = await deriveKey(pin, salt);
      unlockVault(key);
      navigate('/vault/dashboard');
    } catch (err: any) {
      setError('Failed to unlock vault');
    } finally {
      setLoading(false);
    }
  };

  const handleWebAuthnUnlock = async () => {
    if (!webAuthnSupported) {
      setError('Device authentication is not supported on this browser.');
      return;
    }
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const storedIdParams = localStorage.getItem(`vault_bio_id_${user.id}`);
      const storedKeyBase64 = localStorage.getItem(`vault_bio_key_${user.id}`);
      
      if (!storedKeyBase64) {
         setError('Biometric access not configured on this device. Please unlock with PIN first and enable it in Vault Settings.');
         return;
      }
      
      let allowCredentials = undefined;
      if (storedIdParams) {
         try {
           const idArr = Uint8Array.from(atob(storedIdParams), c => c.charCodeAt(0));
           allowCredentials = [{ id: idArr, type: 'public-key' }];
         } catch(e) {}
      }

      const credential = await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          timeout: 60000,
          rpId: window.location.hostname,
          userVerification: 'required',
          ...(allowCredentials ? { allowCredentials } : {})
        },
      });

      if (credential) {
         // Reconstruct the key from LocalStorage
         const rawKey = Uint8Array.from(atob(storedKeyBase64), c => c.charCodeAt(0));
         const importedKey = await crypto.subtle.importKey(
           'raw',
           rawKey,
           'AES-GCM',
           true,
           ['encrypt', 'decrypt']
         );
         unlockVault(importedKey);
         navigate('/vault/dashboard');
      }
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
         // cancelled
      } else {
         setError('Authentication failed. Please use your PIN.');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-primary-500"><Lock className="w-8 h-8" /></div>
      </div>
    );
  }

  if (isUnlocked) return <Outlet />;

  return (
    <div className="max-w-md mx-auto mt-8 animate-fade-in-up">
      <div className="glass-card-solid overflow-hidden">
        <div className="bg-gradient-to-br from-primary-700 to-primary-900 p-7 text-center text-white">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-white/10 mb-3 backdrop-blur-sm">
            <ShieldCheck className="w-7 h-7 text-primary-200" />
          </div>
          <h2 className="text-xl font-bold">Private Vault</h2>
          <p className="text-primary-200 mt-1 text-sm">
            {isSettingUp ? 'Set up your secure vault' : 'Your private information is locked.'}
          </p>
        </div>

        <div className="p-6">
          {error && (
             <div className="mb-4 p-3 bg-red-50/80 text-red-600 text-sm rounded-xl border border-red-200">
               {error}
             </div>
          )}

          {isSettingUp ? (
            <form onSubmit={handleSetup} className="space-y-3">
              <div className="bg-amber-50/80 border border-amber-200 p-3 rounded-xl mb-4">
                <p className="text-xs text-amber-800 font-medium leading-relaxed">
                  <strong>Important:</strong> Your Vault PIN encrypts your data. We do not store this PIN. If you forget it, your vault data cannot be recovered.
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-primary-700 mb-1">Create Vault PIN</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  autoComplete="new-password"
                  className="glass-input"
                  placeholder="At least 6 characters"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-primary-700 mb-1">Confirm PIN</label>
                <input
                  type="password"
                  required
                  value={confirmPin}
                  onChange={e => setConfirmPin(e.target.value)}
                  autoComplete="new-password"
                  className="glass-input"
                  placeholder="Confirm PIN"
                />
              </div>
              <button type="submit" disabled={loading} className="w-full glass-btn justify-center py-2.5 mt-1">
                {loading ? 'Setting up…' : 'Setup Vault'}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <form onSubmit={handleUnlock} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-primary-700 mb-1">Vault PIN</label>
                  <input
                    type="password"
                    required
                    value={pin}
                    onChange={e => setPin(e.target.value)}
                    autoComplete="current-password"
                    className="glass-input text-center tracking-widest text-lg py-3"
                    placeholder="••••••"
                  />
                </div>
                <button type="submit" disabled={loading} className="w-full glass-btn justify-center py-2.5">
                  <Unlock className="w-5 h-5" /> Unlock Vault
                </button>
              </form>

              {webAuthnSupported && (
                <>
                  <div className="relative flex py-2 items-center">
                    <div className="flex-grow border-t border-primary-200/50"></div>
                    <span className="flex-shrink-0 mx-4 text-primary-400 text-xs font-medium">OR</span>
                    <div className="flex-grow border-t border-primary-200/50"></div>
                  </div>
                  
                  <button
                    type="button"
                    onClick={handleWebAuthnUnlock}
                    className="w-full glass-btn-secondary justify-center py-2.5 bg-white/60 hover:bg-white"
                  >
                    <Fingerprint className="w-5 h-5" /> Use Device Biometric / Passkey
                  </button>
                  <p className="text-center text-[0.65rem] text-primary-500 mt-1">
                    Use your device's biometric, face ID, or screen-lock authentication.
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
