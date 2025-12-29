import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing, Typography } from '@/constants/theme';

/**
 * OAuth Callback Screen
 *
 * Handles the redirect after Google OAuth sign-in.
 * The Supabase client automatically picks up the session via onAuthStateChange
 * in the useAuth hook, so we just show a loading state and redirect.
 */
export default function AuthCallbackScreen() {
  const router = useRouter();

  useEffect(() => {
    // Give the auth state a moment to update, then redirect
    const timer = setTimeout(() => {
      router.replace('/(tabs)');
    }, 1500);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.accent} />
      <Text style={styles.text}>Signing you in...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    gap: Spacing.lg,
  },
  text: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.md,
  },
});
