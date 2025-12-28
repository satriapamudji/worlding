import { Redirect } from 'expo-router';

import { useAuth } from '@/hooks/useAuth';

/**
 * Root index - Redirect to onboarding or main app based on auth
 * 
 * This ensures the app always starts with the onboarding flow.
 * In a production app, you'd check if user has completed onboarding
 * and redirect to (tabs) if they have.
 */
export default function Index() {
  const { session, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (session) {
    return <Redirect href="/(tabs)" />;
  }
  
  return <Redirect href="/onboarding" />;
}
