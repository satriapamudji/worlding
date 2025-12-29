import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LegalModal, SettingsRow, SettingsSection, SignOutSheet, StorageUsage } from '@/components';
import { Colors, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useNotificationPrefs } from '@/hooks/useNotificationPrefs';
import { getMyWorlds, syncStorageIfStale } from '@/lib/api';
import { getStorageInfo } from '@/lib/database.types';
import type { StorageInfo } from '@/lib/database.types';

// TODO: Get from subscription state (RevenueCat/Superwall)
const IS_PREMIUM = false;
const SUBSCRIPTION_STATUS = IS_PREMIUM ? 'Worlding+' : 'Free';

/**
 * Profile Screen - Redesigned
 *
 * Structure:
 * - Profile header with avatar (editable), name, email, stats
 * - Premium banner (Worlding+)
 * - Account settings section
 * - Support section
 * - Sign out (separate, destructive)
 * - Footer with version and links
 */
export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signOut, user, profile, profileLoading, refreshProfile } = useAuth();
  const { prefs: notificationPrefs } = useNotificationPrefs();

  const [showSignOutSheet, setShowSignOutSheet] = useState(false);
  const [legalModalType, setLegalModalType] = useState<'terms' | 'privacy' | null>(null);
  const [stats, setStats] = useState({ worldCount: 0, photoCount: 0 });
  const [statsLoading, setStatsLoading] = useState(true);

  // Derive display values from profile
  const displayName = profile?.name ?? 'User';
  const firstName = displayName.split(' ')[0];
  const avatarUrl = profile?.avatar_url ?? null;
  const userEmail = user?.email ?? '';
  const storageInfo: StorageInfo | null = profile ? getStorageInfo(profile) : null;
  const notificationsEnabled = notificationPrefs.pushEnabled;

  // Fetch stats and sync storage when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      async function loadStats() {
        setStatsLoading(true);
        const { data: worlds } = await getMyWorlds();

        if (isMounted) {
          setStats({
            worldCount: worlds.length,
            photoCount: worlds.reduce((sum, w) => sum + w.media_count, 0),
          });
          setStatsLoading(false);
        }
      }

      async function syncStorage() {
        // Sync storage with actual bucket usage (only if stale), then refresh profile
        await syncStorageIfStale();
        await refreshProfile();
      }

      loadStats();
      syncStorage();

      return () => {
        isMounted = false;
      };
    }, [refreshProfile])
  );

  // Simple skeleton box component
  const SkeletonBox = ({ width, height }: { width: number; height: number }) => (
    <View style={[styles.skeletonBox, { width, height }]} />
  );

  const handleUpgrade = () => {
    router.push('/paywall');
  };

  const handleSignOut = async () => {
    setShowSignOutSheet(false);
    await signOut();
    router.replace('/auth' as Href);
  };

  const handleEditProfile = () => {
    router.push('/settings/edit-profile');
  };

  const handleAvatarPress = () => {
    router.push('/settings/edit-profile');
  };

  const openURL = (url: string) => {
    Linking.openURL(url).catch(console.error);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
          {/* Avatar with Edit Badge */}
          <Pressable onPress={handleAvatarPress} style={styles.avatarContainer}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <LinearGradient
                colors={[Colors.accent, Colors.accentDark]}
                style={styles.avatar}
              >
                <Text style={styles.avatarText}>{firstName.slice(0, 1)}</Text>
              </LinearGradient>
            )}
          </Pressable>

          {/* Name */}
          {profileLoading ? (
            <SkeletonBox width={120} height={24} />
          ) : (
            <Text style={styles.userName}>{displayName}</Text>
          )}

          {/* Email */}
          <Text style={styles.userEmail}>{userEmail}</Text>

          {/* Stats */}
          {statsLoading ? (
            <SkeletonBox width={140} height={16} />
          ) : (
            <Text style={styles.stats}>
              {stats.worldCount} Worlds · {stats.photoCount} photos
            </Text>
          )}
        </Animated.View>

        {/* Premium Banner */}
        <Animated.View
          entering={FadeInUp.delay(100).duration(400)}
          style={styles.premiumSection}
        >
          <Pressable onPress={handleUpgrade}>
            <LinearGradient
              colors={['rgba(255, 87, 61, 0.15)', 'rgba(255, 87, 61, 0.05)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.premiumBanner}
            >
              <View style={styles.premiumIcon}>
                <Ionicons name="star" size={16} color={Colors.accent} />
              </View>
              <View style={styles.premiumContent}>
                <Text style={styles.premiumTitle}>Worlding+</Text>
                <Text style={styles.premiumSubtitle}>Unlock unlimited Worlds</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.accent} />
            </LinearGradient>
          </Pressable>
        </Animated.View>

        {/* Account Settings */}
        <Animated.View
          entering={FadeInUp.delay(200).duration(400)}
          style={styles.settingsContainer}
        >
          <SettingsSection title="Account">
            <SettingsRow
              icon="person-outline"
              label="Edit Profile"
              onPress={handleEditProfile}
            />
            <SettingsRow
              icon="notifications-outline"
              label="Notifications"
              value={notificationsEnabled ? 'On' : 'Off'}
              onPress={() => router.push('/settings/notifications')}
            />
            <SettingsRow
              icon="lock-closed-outline"
              label="Privacy"
              onPress={() => router.push('/settings/privacy')}
            />
            {storageInfo && (
              <View style={styles.storageContainer}>
                <StorageUsage storage={storageInfo} compact />
              </View>
            )}
          </SettingsSection>
        </Animated.View>

        {/* Subscription Section */}
        <Animated.View
          entering={FadeInUp.delay(300).duration(400)}
          style={styles.settingsContainer}
        >
          <SettingsSection title="Subscription">
            <SettingsRow
              icon="card-outline"
              label="Current Plan"
              value={SUBSCRIPTION_STATUS}
              showChevron={false}
            />
            {IS_PREMIUM ? (
              <SettingsRow
                icon="settings-outline"
                label="Manage Subscription"
                onPress={() => {
                  // TODO: Open subscription management
                  openURL('https://apps.apple.com/account/subscriptions');
                }}
              />
            ) : null}
            <SettingsRow
              icon="refresh-outline"
              label="Restore Purchases"
              onPress={() => {
                // TODO: Implement restore purchases via RevenueCat
                console.log('Restore purchases');
              }}
            />
          </SettingsSection>
        </Animated.View>

        {/* Support Section */}
        <Animated.View
          entering={FadeInUp.delay(400).duration(400)}
          style={styles.settingsContainer}
        >
          <SettingsSection title="Support">
            <SettingsRow
              icon="help-circle-outline"
              label="Help Center"
              onPress={() => openURL('https://worlding.app/help')}
            />
            <SettingsRow
              icon="mail-outline"
              label="Contact Us"
              onPress={() => openURL('mailto:contact@worlding.fun')}
            />
            <SettingsRow
              icon="star-outline"
              label="Rate Worlding"
              onPress={() => {
                // TODO: Open app store rating
                console.log('Open app store');
              }}
            />
          </SettingsSection>
        </Animated.View>

        {/* Sign Out */}
        <Animated.View
          entering={FadeInUp.delay(500).duration(400)}
          style={styles.settingsContainer}
        >
          <SettingsSection>
            <SettingsRow
              icon="log-out-outline"
              label="Sign Out"
              destructive
              showChevron={false}
              onPress={() => setShowSignOutSheet(true)}
            />
          </SettingsSection>
        </Animated.View>

        {/* Footer */}
        <Animated.View
          entering={FadeIn.delay(600).duration(400)}
          style={styles.footer}
        >
          <Text style={styles.version}>Version 1.0.0</Text>
          <View style={styles.footerLinks}>
            <Pressable onPress={() => setLegalModalType('terms')}>
              <Text style={styles.footerLink}>Terms</Text>
            </Pressable>
            <Text style={styles.footerDot}>·</Text>
            <Pressable onPress={() => setLegalModalType('privacy')}>
              <Text style={styles.footerLink}>Privacy</Text>
            </Pressable>
          </View>
        </Animated.View>
      </ScrollView>

      {/* Sign Out Confirmation Sheet */}
      <SignOutSheet
        visible={showSignOutSheet}
        onClose={() => setShowSignOutSheet(false)}
        onConfirm={handleSignOut}
        userEmail={userEmail}
      />

      {/* Legal Modal */}
      {legalModalType && (
        <LegalModal
          visible={true}
          type={legalModalType}
          onClose={() => setLegalModalType(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },

  // Header
  header: {
    alignItems: 'center',
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.xxl,
    fontWeight: '600',
  },
  userName: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.xl,
    fontWeight: 'bold',
    marginBottom: Spacing.xs,
  },
  userEmail: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.sm,
    marginBottom: Spacing.xs,
  },
  stats: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.sm,
  },
  skeletonBox: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    marginBottom: Spacing.xs,
  },

  // Premium Banner
  premiumSection: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  premiumBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 87, 61, 0.3)',
  },
  premiumIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 87, 61, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  premiumContent: {
    flex: 1,
  },
  premiumTitle: {
    color: Colors.accent,
    fontSize: Typography.sizes.md,
    fontWeight: '600',
    marginBottom: 2,
  },
  premiumSubtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.sm,
  },

  // Settings
  settingsContainer: {
    paddingHorizontal: Spacing.lg,
  },
  storageContainer: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },

  // Footer
  footer: {
    alignItems: 'center',
    paddingTop: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  version: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.xs,
    marginBottom: Spacing.sm,
  },
  footerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerLink: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.xs,
  },
  footerDot: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.xs,
    marginHorizontal: Spacing.sm,
  },
});
