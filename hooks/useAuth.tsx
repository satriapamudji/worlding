import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/database.types';

const SESSION_BOOTSTRAP_TIMEOUT_MS = 5000;

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  profileLoading: boolean;
  hasProfile: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  // Fetch profile for a user
  const fetchProfile = useCallback(async (userId: string) => {
    setProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        // Profile doesn't exist - user needs onboarding
        if (error.code === 'PGRST116') {
          setProfile(null);
          return;
        }
        console.warn('Error fetching profile:', error.message);
        setProfile(null);
        return;
      }
      
      setProfile(data as Profile);
    } catch (e) {
      console.error('Failed to fetch profile:', e);
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  // Refresh profile (called after onboarding or profile updates)
  const refreshProfile = useCallback(async () => {
    if (session?.user?.id) {
      await fetchProfile(session.user.id);
    }
  }, [session?.user?.id, fetchProfile]);

  useEffect(() => {
    let isMounted = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let hasResolved = false;

    const finalizeLoading = () => {
      if (hasResolved) return;
      hasResolved = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      setLoading(false);
    };

    // Hydrate initial session
    timeoutId = setTimeout(() => {
      if (!isMounted) return;
      finalizeLoading();
    }, SESSION_BOOTSTRAP_TIMEOUT_MS);

    supabase.auth.getSession()
      .then(({ data }) => {
        if (!isMounted) return;

        const currentSession = data.session ?? null;
        setSession(currentSession);

        if (currentSession?.user?.id) {
          void fetchProfile(currentSession.user.id);
        } else {
          setProfile(null);
          setProfileLoading(false);
        }
      })
      .catch(() => {
        if (!isMounted) return;
      })
      .finally(() => {
        if (!isMounted) return;
        finalizeLoading();
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {

      setSession(newSession ?? null);

      // When user signs in/out, update profile
      if (newSession?.user?.id) {
        void fetchProfile(newSession.user.id);
      } else {
        setProfile(null);
        setProfileLoading(false);
      }

      if (isMounted) {
        finalizeLoading();
      }
    });

    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      subscription?.subscription?.unsubscribe?.();
    };
  }, [fetchProfile]);

  const value: AuthContextValue = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      profileLoading,
      hasProfile: !!profile,
      signOut: async () => {
        setProfile(null);
        await supabase.auth.signOut();
      },
      refreshProfile,
    }),
    [session, profile, loading, profileLoading, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
