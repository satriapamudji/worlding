import { Redirect, type Href } from 'expo-router';

import { useAuth } from '@/hooks/useAuth';
import { useOnboarding } from '@/hooks/useOnboarding';

/**
 * Root index - Redirect based on auth, profile, and onboarding status
 *
 * Priority:
 * 1. Authenticated + has profile -> main app (tabs)
 * 2. Authenticated + no profile -> profile setup
 * 3. Unauthenticated + completed onboarding -> auth screen
 * 4. Unauthenticated + not completed onboarding -> onboarding flow
 */
export default function Index() {
  const { session, hasProfile, loading: authLoading, profileLoading } = useAuth();
  const { hasCompleted, loading: onboardingLoading } = useOnboarding();

  // Wait for all loading states to resolve
  if (authLoading || onboardingLoading || profileLoading) {
    return null;
  }

  if (session) {
    // User is authenticated - check if they have a profile
    if (hasProfile) {
      return <Redirect href="/(tabs)" />;
    }
    // No profile yet - send to profile setup
    return <Redirect href={'/profile-setup' as Href} />;
  }

  // Not authenticated - check onboarding status
  if (hasCompleted) {
    return <Redirect href={'/auth' as Href} />;
  }

  return <Redirect href="/onboarding" />;
}
