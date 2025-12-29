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

import { createProfile } from '@/lib/api/profiles';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/database.types';

const SESSION_BOOTSTRAP_TIMEOUT_MS = 5000;

type AuthMetadata = {
  full_name?: string;
  name?: string;
  avatar_url?: string;
  picture?: string;
};

const getMetadataString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const getGoogleProfileMetadata = (
  user: User
): { name: string; avatarUrl: string | null } | null => {
  if (user.app_metadata?.provider !== 'google') {
    return null;
  }

  const metadata = (user.user_metadata as AuthMetadata | undefined) ?? {};
  const emailName = user.email ? user.email.split('@')[0] : null;
  const name =
    getMetadataString(metadata.full_name) ||
    getMetadataString(metadata.name) ||
    getMetadataString(emailName);

  if (!name) {
    return null;
  }

  const avatarUrl =
    getMetadataString(metadata.avatar_url) ||
    getMetadataString(metadata.picture);

  return { name, avatarUrl: avatarUrl ?? null };
};

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
  const fetchProfile = useCallback(async (user: User) => {
    setProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (error) {
        // Profile doesn't exist - try auto-create for Google OAuth.
        if (error.code === 'PGRST116') {
          const googleProfile = getGoogleProfileMetadata(user);
          if (googleProfile) {
            const { data: createdProfile, error: createError } = await createProfile({
              id: user.id,
              name: googleProfile.name,
              avatar_url: googleProfile.avatarUrl,
            });

            if (createError) {
              console.warn('Failed to auto-create profile:', createError);

              const { data: retryProfile, error: retryError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

              if (!retryError && retryProfile) {
                setProfile(retryProfile as Profile);
                return;
              }

              setProfile(null);
              return;
            }

            if (createdProfile) {
              setProfile(createdProfile);
              return;
            }
          }

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
    if (session?.user) {
      await fetchProfile(session.user);
    }
  }, [session?.user, fetchProfile]);

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

        if (currentSession?.user) {
          void fetchProfile(currentSession.user);
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
      if (newSession?.user) {
        void fetchProfile(newSession.user);
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
