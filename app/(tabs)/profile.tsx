import FontAwesome from '@expo/vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SettingsRow, SettingsSection, SignOutSheet } from '@/components';
import { CURRENT_USER, MOCK_WORLDS } from '@/constants/mockData';
import { Colors, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

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
  const { signOut, user } = useAuth();

  const [showSignOutSheet, setShowSignOutSheet] = useState(false);

  const totalPhotos = MOCK_WORLDS.reduce((sum, w) => sum + w.photoCount, 0);
  const firstName = CURRENT_USER.name.split(' ')[0];
  const userEmail = user?.email || 'alex@example.com';

  const handleUpgrade = () => {
    router.push('/paywall');
  };

  const handleSignOut = async () => {
    setShowSignOutSheet(false);
    await signOut();
    router.replace('/auth');
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
            {CURRENT_USER.avatar ? (
              <Image source={{ uri: CURRENT_USER.avatar }} style={styles.avatar} />
            ) : (
              <LinearGradient
                colors={[Colors.accent, Colors.accentDark]}
                style={styles.avatar}
              >
                <Text style={styles.avatarText}>{firstName.slice(0, 1)}</Text>
              </LinearGradient>
            )}
            {/* Edit Badge */}
            <View style={styles.editBadge}>
              <FontAwesome name="pencil" size={10} color={Colors.textPrimary} />
            </View>
          </Pressable>

          {/* Name */}
          <Text style={styles.userName}>{CURRENT_USER.name}</Text>

          {/* Email */}
          <Text style={styles.userEmail}>{userEmail}</Text>

          {/* Stats */}
          <Text style={styles.stats}>
            {MOCK_WORLDS.length} Worlds · {totalPhotos} photos
          </Text>
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
                <FontAwesome name="star" size={16} color={Colors.accent} />
              </View>
              <View style={styles.premiumContent}>
                <Text style={styles.premiumTitle}>Worlding+</Text>
                <Text style={styles.premiumSubtitle}>Unlock unlimited Worlds</Text>
              </View>
              <FontAwesome name="chevron-right" size={14} color={Colors.accent} />
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
              icon="user"
              label="Edit Profile"
              onPress={handleEditProfile}
            />
            <SettingsRow
              icon="bell"
              label="Notifications"
              onPress={() => router.push('/settings/notifications')}
            />
            <SettingsRow
              icon="lock"
              label="Privacy"
              onPress={() => router.push('/settings/privacy')}
            />
          </SettingsSection>
        </Animated.View>

        {/* Subscription Section */}
        <Animated.View
          entering={FadeInUp.delay(300).duration(400)}
          style={styles.settingsContainer}
        >
          <SettingsSection title="Subscription">
            <SettingsRow
              icon="credit-card"
              label="Current Plan"
              value={SUBSCRIPTION_STATUS}
              showChevron={false}
            />
            {IS_PREMIUM ? (
              <SettingsRow
                icon="cog"
                label="Manage Subscription"
                onPress={() => {
                  // TODO: Open subscription management
                  openURL('https://apps.apple.com/account/subscriptions');
                }}
              />
            ) : null}
            <SettingsRow
              icon="refresh"
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
              icon="question-circle"
              label="Help Center"
              onPress={() => openURL('https://worlding.app/help')}
            />
            <SettingsRow
              icon="envelope"
              label="Contact Us"
              onPress={() => openURL('mailto:support@worlding.app')}
            />
            <SettingsRow
              icon="star-o"
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
              icon="sign-out"
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
            <Pressable onPress={() => openURL('https://worlding.app/terms')}>
              <Text style={styles.footerLink}>Terms</Text>
            </Pressable>
            <Text style={styles.footerDot}>·</Text>
            <Pressable onPress={() => openURL('https://worlding.app/privacy')}>
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
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
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
