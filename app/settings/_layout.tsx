import { Stack } from 'expo-router';
import React from 'react';

import { RequireAuth } from '@/components/RequireAuth';
import { Colors } from '@/constants/theme';

/**
 * Settings Stack Layout
 *
 * Handles navigation for all settings screens:
 * - Edit Profile
 * - Notifications
 * - Privacy
 */
export default function SettingsLayout() {
  return (
    <RequireAuth>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background },
          animation: 'ios_from_right',
          gestureEnabled: true,
          gestureDirection: 'horizontal',
          fullScreenGestureEnabled: true,
          animationDuration: 350,
        }}
      >
        <Stack.Screen name="edit-profile" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="privacy" />
      </Stack>
    </RequireAuth>
  );
}
