import { createContext, useContext, useState, useEffect, type ReactNode, useCallback } from 'react';

interface VaultContextType {
  isUnlocked: boolean;
  vaultKey: CryptoKey | null;
  unlockVault: (key: CryptoKey) => void;
  lockVault: () => void;
  autoLockMinutes: number;
  setAutoLockMinutes: (mins: number) => void;
}

const VaultContext = createContext<VaultContextType | undefined>(undefined);

export function VaultProvider({ children }: { children: ReactNode }) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [vaultKey, setVaultKey] = useState<CryptoKey | null>(null);
  const [autoLockMinutes, setAutoLockMinutes] = useState(10);
  const [lastActivity, setLastActivity] = useState(Date.now());

  const lockVault = useCallback(() => {
    setIsUnlocked(false);
    setVaultKey(null); // Wipe key from memory
  }, []);

  const unlockVault = useCallback((key: CryptoKey) => {
    setVaultKey(key);
    setIsUnlocked(true);
    setLastActivity(Date.now());
  }, []);

  // Update activity timestamp on user interaction
  useEffect(() => {
    if (!isUnlocked) return;

    const handleActivity = () => {
      setLastActivity(Date.now());
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);
    window.addEventListener('scroll', handleActivity);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('scroll', handleActivity);
    };
  }, [isUnlocked]);

  // Check for auto-lock
  useEffect(() => {
    if (!isUnlocked) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivity;
      const timeoutMs = autoLockMinutes * 60 * 1000;

      if (timeSinceLastActivity > timeoutMs) {
        lockVault();
      }
    }, 10000); // check every 10 seconds

    return () => clearInterval(interval);
  }, [isUnlocked, lastActivity, autoLockMinutes, lockVault]);

  // Also lock when the user leaves the page or unmounts (e.g. logs out)
  useEffect(() => {
    return () => {
      lockVault();
    };
  }, [lockVault]);

  return (
    <VaultContext.Provider value={{
      isUnlocked,
      vaultKey,
      unlockVault,
      lockVault,
      autoLockMinutes,
      setAutoLockMinutes
    }}>
      {children}
    </VaultContext.Provider>
  );
}

export function useVault() {
  const context = useContext(VaultContext);
  if (context === undefined) {
    throw new Error('useVault must be used within a VaultProvider');
  }
  return context;
}
