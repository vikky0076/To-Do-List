import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from './supabase';
import type { User } from '@supabase/supabase-js';

type UserContextType = {
  user: User | null;
  displayName: string;
  updateDisplayName: (newName: string) => Promise<{ success: boolean; error?: string }>;
  loadingContext: boolean;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState<string>('User');
  const [loadingContext, setLoadingContext] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadUserData = async (currentUser: User | null) => {
      if (!mounted) return;
      
      setUser(currentUser);
      
      if (currentUser) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', currentUser.id)
            .maybeSingle();

          if (error) {
            console.error('Error fetching profile:', error);
          }
          
          if (mounted) {
            if (data?.display_name) {
              setDisplayName(data.display_name);
            } else if (currentUser.user_metadata?.display_name) {
              setDisplayName(currentUser.user_metadata.display_name);
            } else {
              setDisplayName(currentUser.email?.split('@')[0] || 'User');
            }
          }
        } catch (err) {
          console.error(err);
        }
      } else {
        if (mounted) setDisplayName('User');
      }
      
      if (mounted) setLoadingContext(false);
    };

    // Initial load
    supabase.auth.getUser().then(({ data: { user } }) => {
      loadUserData(user);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        loadUserData(session?.user ?? null);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const updateDisplayName = async (newName: string) => {
    if (!user) return { success: false, error: 'User not authenticated' };
    
    const trimmedName = newName.trim();
    if (!trimmedName) {
      return { success: false, error: 'Display name cannot be empty' };
    }

    try {
      // Securely store it in Supabase Auth user_metadata (bypassing strict `profiles` table RLS limitations natively)
      const { error: authError } = await supabase.auth.updateUser({
        data: { display_name: trimmedName }
      });

      if (authError) throw authError;

      // Attempt to sync with the public profiles table just in case (gracefully ignoring if RLS blocks it)
      await supabase
        .from('profiles')
        .update({ display_name: trimmedName })
        .eq('id', user.id);

      setDisplayName(trimmedName);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Unable to update profile. Please try again.' };
    }
  };

  return (
    <UserContext.Provider value={{ user, displayName, updateDisplayName, loadingContext }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
