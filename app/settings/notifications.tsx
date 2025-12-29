import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SettingsRow } from '@/components/SettingsRow';
import { SettingsSection } from '@/components/SettingsSection';
import { SettingsToggle } from '@/components/SettingsToggle';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { useNotificationPrefs } from '@/hooks/useNotificationPrefs';
import { getPushPermissionState, requestPushPermission, type PushPermissionState } from '@/lib/notifications';

// TODO: Get from subscription state
const IS_PREMIUM = false;

/**
 * Notifications Settings Screen
 *
 * Features:
 * - Push notification toggles
 * - Email notification toggles
 * - Grouped by category
 */
export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { prefs, loading, updatePrefs } = useNotificationPrefs();
  const [permissionState, setPermissionState] = useState<PushPermissionState | null>(null);
  const [isRequestingPush, setIsRequestingPush] = useState(false);

  // Local state mirrors persisted prefs for smoother UI
  const [pushEnabled, setPushEnabled] = useState(false);
  const [newPhotos, setNewPhotos] = useState(true);
  const [worldInvites, setWorldInvites] = useState(true);
  const [throwbacks, setThrowbacks] = useState(false);

  // Email settings
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [weeklyDigest, setWeeklyDigest] = useState(false);
  const [productUpdates, setProductUpdates] = useState(false);
  const pushPermissionDenied = permissionState?.granted === false;

  useEffect(() => {
    if (loading) return;
    setPushEnabled(prefs.pushEnabled);
    setNewPhotos(prefs.newPhotos);
    setWorldInvites(prefs.worldInvites);
    setThrowbacks(prefs.throwbacks);
    setEmailEnabled(prefs.emailEnabled);
    setWeeklyDigest(prefs.weeklyDigest);
    setProductUpdates(prefs.productUpdates);
  }, [loading, prefs]);

  useEffect(() => {
    if (loading) return;
    if (!prefs.prompted) {
      updatePrefs({ prompted: true });
    }
  }, [loading, prefs.prompted, updatePrefs]);

  useEffect(() => {
    if (loading) return;
    let isMounted = true;

    const syncPermission = async () => {
      const state = await getPushPermissionState();
      if (!isMounted) return;
      setPermissionState(state);
      if (!state.granted && pushEnabled) {
        setPushEnabled(false);
        updatePrefs({ pushEnabled: false });
      }
    };

    void syncPermission();

    return () => {
      isMounted = false;
    };
  }, [loading, pushEnabled, updatePrefs]);

  const handlePushToggle = useCallback(async (value: boolean) => {
    if (!value) {
      setPushEnabled(false);
      updatePrefs({ pushEnabled: false, prompted: true });
      return;
    }

    setIsRequestingPush(true);
    try {
      const permission = await requestPushPermission();
      setPermissionState(permission);

      if (permission.granted) {
        setPushEnabled(true);
        updatePrefs({ pushEnabled: true, prompted: true });
      } else {
        setPushEnabled(false);
        updatePrefs({ pushEnabled: false, prompted: true });
        if (!permission.canAskAgain) {
          Alert.alert(
            'Enable Notifications',
            'Notifications are disabled at the system level. You can enable them in Settings.',
            [
              { text: 'Not now', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ]
          );
        }
      }
    } finally {
      setIsRequestingPush(false);
    }
  }, [updatePrefs]);

  const handleNewPhotosToggle = useCallback((value: boolean) => {
    setNewPhotos(value);
    updatePrefs({ newPhotos: value });
  }, [updatePrefs]);

  const handleWorldInvitesToggle = useCallback((value: boolean) => {
    setWorldInvites(value);
    updatePrefs({ worldInvites: value });
  }, [updatePrefs]);

  const handleThrowbacksToggle = useCallback((value: boolean) => {
    setThrowbacks(value);
    updatePrefs({ throwbacks: value });
  }, [updatePrefs]);

  const handleEmailToggle = useCallback((value: boolean) => {
    setEmailEnabled(value);
    updatePrefs({ emailEnabled: value });
  }, [updatePrefs]);

  const handleWeeklyDigestToggle = useCallback((value: boolean) => {
    setWeeklyDigest(value);
    updatePrefs({ weeklyDigest: value });
  }, [updatePrefs]);

  const handleProductUpdatesToggle = useCallback((value: boolean) => {
    setProductUpdates(value);
    updatePrefs({ productUpdates: value });
  }, [updatePrefs]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </Pressable>

        <Text style={styles.headerTitle}>Notifications</Text>

        <View style={styles.placeholder} />
      </Animated.View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Push Notifications */}
        <Animated.View entering={FadeInUp.delay(100).duration(400)}>
          <SettingsSection
            title="Push Notifications"
            footer={
              pushPermissionDenied
                ? 'Notifications are currently off at the system level.'
                : 'Control which notifications appear on your device.'
            }
          >
            <SettingsToggle
              icon="notifications-outline"
              label="Enable Push Notifications"
              value={pushEnabled}
              onValueChange={handlePushToggle}
              disabled={isRequestingPush}
            />
            {!permissionState?.granted && permissionState?.canAskAgain === false && (
              <SettingsRow
                icon="settings-outline"
                label="Open System Settings"
                onPress={() => Linking.openSettings()}
              />
            )}
          </SettingsSection>
        </Animated.View>

        {/* Activity Notifications */}
        <Animated.View entering={FadeInUp.delay(200).duration(400)}>
          <SettingsSection title="Activity">
            <SettingsToggle
              icon="image-outline"
              label="New Photos"
              description="When someone adds photos to your World"
              value={newPhotos}
              onValueChange={handleNewPhotosToggle}
              disabled={!pushEnabled || pushPermissionDenied}
            />
            <SettingsToggle
              icon="people-outline"
              label="World Invites"
              description="When you're invited to a World"
              value={worldInvites}
              onValueChange={handleWorldInvitesToggle}
              disabled={!pushEnabled || pushPermissionDenied}
            />
            {IS_PREMIUM ? (
              <SettingsToggle
                icon="time-outline"
                label="Throwbacks"
                description="Memories from past Worlds"
                value={throwbacks}
                onValueChange={handleThrowbacksToggle}
                disabled={!pushEnabled || pushPermissionDenied}
              />
            ) : (
              <SettingsRow
                icon="time-outline"
                label="Throwbacks"
                value="Worlding+"
                onPress={() => router.push('/paywall')}
              />
            )}
          </SettingsSection>
        </Animated.View>

        {/* Email Notifications */}
        <Animated.View entering={FadeInUp.delay(300).duration(400)}>
          <SettingsSection
            title="Email Notifications"
            footer="Manage emails from Worlding."
          >
            <SettingsToggle
              icon="mail-outline"
              label="Email Notifications"
              value={emailEnabled}
              onValueChange={handleEmailToggle}
            />
            <SettingsToggle
              icon="calendar-outline"
              label="Weekly Digest"
              description="Summary of your World activity"
              value={weeklyDigest}
              onValueChange={handleWeeklyDigestToggle}
              disabled={!emailEnabled}
            />
            <SettingsToggle
              icon="megaphone-outline"
              label="Product Updates"
              description="New features and improvements"
              value={productUpdates}
              onValueChange={handleProductUpdatesToggle}
              disabled={!emailEnabled}
            />
          </SettingsSection>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.lg,
    fontWeight: '600',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
});
