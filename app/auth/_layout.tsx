import { Stack } from 'expo-router';

import { Colors } from '@/constants/theme';

/**
 * Auth Layout - Stack navigator for auth screens
 *
 * Provides:
 * - Consistent dark background
 * - Slide animation between screens
 * - No headers (handled manually in screens)
 */
export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background },
        animation: 'slide_from_right',
      }}
    />
  );
}
