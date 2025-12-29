import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SettingsRow } from '@/components/SettingsRow';
import { SettingsSection } from '@/components/SettingsSection';
import { SettingsToggle } from '@/components/SettingsToggle';
import { Colors, Spacing, Typography } from '@/constants/theme';

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

  // Push notification settings
  const [pushEnabled, setPushEnabled] = useState(true);
  const [newPhotos, setNewPhotos] = useState(true);
  const [worldInvites, setWorldInvites] = useState(true);
  const [throwbacks, setThrowbacks] = useState(true);

  // Email settings
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(true);
  const [productUpdates, setProductUpdates] = useState(false);

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
            footer="Control which notifications appear on your device."
          >
            <SettingsToggle
              icon="notifications-outline"
              label="Enable Push Notifications"
              value={pushEnabled}
              onValueChange={setPushEnabled}
            />
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
              onValueChange={setNewPhotos}
              disabled={!pushEnabled}
            />
            <SettingsToggle
              icon="people-outline"
              label="World Invites"
              description="When you're invited to a World"
              value={worldInvites}
              onValueChange={setWorldInvites}
              disabled={!pushEnabled}
            />
            {IS_PREMIUM ? (
              <SettingsToggle
                icon="time-outline"
                label="Throwbacks"
                description="Memories from past Worlds"
                value={throwbacks}
                onValueChange={setThrowbacks}
                disabled={!pushEnabled}
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
              onValueChange={setEmailEnabled}
            />
            <SettingsToggle
              icon="calendar-outline"
              label="Weekly Digest"
              description="Summary of your World activity"
              value={weeklyDigest}
              onValueChange={setWeeklyDigest}
              disabled={!emailEnabled}
            />
            <SettingsToggle
              icon="megaphone-outline"
              label="Product Updates"
              description="New features and improvements"
              value={productUpdates}
              onValueChange={setProductUpdates}
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
