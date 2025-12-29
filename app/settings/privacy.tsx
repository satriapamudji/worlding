import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LegalModal } from '@/components/LegalModal';
import { SettingsRow } from '@/components/SettingsRow';
import { SettingsSection } from '@/components/SettingsSection';
import { SettingsToggle } from '@/components/SettingsToggle';
import { Colors, Spacing, Typography } from '@/constants/theme';

/**
 * Privacy Settings Screen
 *
 * Features:
 * - Photo sync settings (quality, cellular, excluded albums)
 * - Storage management
 * - Profile visibility
 * - Data management
 * - Account deletion
 */
export default function PrivacyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Photo settings
  const [autoSync, setAutoSync] = useState(true);
  const [uploadOriginal, setUploadOriginal] = useState(false);
  const [useCellular, setUseCellular] = useState(false);

  // Profile settings
  const [showActivity, setShowActivity] = useState(true);

  // Legal modal
  const [legalModalType, setLegalModalType] = useState<'terms' | 'privacy' | null>(null);

  // Mock cache size - TODO: Get from actual cache
  const [cacheSize] = useState('128 MB');

  const openSystemSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  };

  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'This will remove cached photos from your device. Photos will be re-downloaded when you view them.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Cache',
          onPress: () => {
            // TODO: Implement cache clearing
            console.log('Cache cleared');
          },
        },
      ]
    );
  };

  const handleExcludedAlbums = () => {
    // TODO: Navigate to excluded albums screen
    Alert.alert(
      'Excluded Albums',
      'Choose which albums to exclude from auto-sync:\n\n• Screenshots\n• Screen Recordings\n• Downloads\n• Recently Deleted',
      [{ text: 'OK' }]
    );
  };

  const handleExportData = () => {
    Alert.alert(
      'Export Your Data',
      'We\'ll prepare a download of all your photos and data. You\'ll receive an email when it\'s ready.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Request Export', onPress: () => console.log('Export requested') },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account, all your Worlds, and photos. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: () => {
            // TODO: Implement account deletion
            console.log('Account deletion requested');
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </Pressable>

        <Text style={styles.headerTitle}>Privacy</Text>

        <View style={styles.placeholder} />
      </Animated.View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Photo Sync Settings */}
        <Animated.View entering={FadeInUp.delay(100).duration(400)}>
          <SettingsSection
            title="Photos"
            footer="Auto-sync adds matching photos from your camera roll to active Worlds."
          >
            <SettingsToggle
              icon="refresh-outline"
              label="Auto-Sync Photos"
              description="Sync photos during World dates"
              value={autoSync}
              onValueChange={setAutoSync}
            />
            <SettingsRow
              icon="folder-open-outline"
              label="Photo Library Access"
              value="Full Access"
              onPress={openSystemSettings}
            />
            <SettingsRow
              icon="ban-outline"
              label="Excluded Albums"
              value="3 albums"
              onPress={handleExcludedAlbums}
            />
          </SettingsSection>
        </Animated.View>

        {/* Upload Settings */}
        <Animated.View entering={FadeInUp.delay(200).duration(400)}>
          <SettingsSection
            title="Upload"
            footer={uploadOriginal
              ? "Original photos use more data and storage but preserve full quality."
              : "Optimized photos are smaller but still high quality."
            }
          >
            <SettingsToggle
              icon="image-outline"
              label="Upload Original Quality"
              description="Use full resolution photos"
              value={uploadOriginal}
              onValueChange={setUploadOriginal}
            />
            <SettingsToggle
              icon="cellular-outline"
              label="Use Cellular Data"
              description="Sync photos over mobile data"
              value={useCellular}
              onValueChange={setUseCellular}
            />
          </SettingsSection>
        </Animated.View>

        {/* Storage & Cache */}
        <Animated.View entering={FadeInUp.delay(300).duration(400)}>
          <SettingsSection
            title="Storage"
            footer="Cached photos allow faster loading when viewing Worlds."
          >
            <SettingsRow
              icon="server-outline"
              label="Cached Photos"
              value={cacheSize}
              showChevron={false}
            />
            <SettingsRow
              icon="trash-outline"
              label="Clear Cache"
              onPress={handleClearCache}
            />
          </SettingsSection>
        </Animated.View>

        {/* Profile Privacy */}
        <Animated.View entering={FadeInUp.delay(400).duration(400)}>
          <SettingsSection
            title="Profile"
            footer="Control how others interact with you in Worlds."
          >
            <SettingsToggle
              icon="eye-outline"
              label="Show Activity Status"
              description="Let others see when you're active"
              value={showActivity}
              onValueChange={setShowActivity}
            />
          </SettingsSection>
        </Animated.View>

        {/* Data Management */}
        <Animated.View entering={FadeInUp.delay(500).duration(400)}>
          <SettingsSection
            title="Your Data"
            footer="Manage your personal data and account."
          >
            <SettingsRow
              icon="download-outline"
              label="Export Your Data"
              onPress={handleExportData}
            />
            <SettingsRow
              icon="document-text-outline"
              label="Privacy Policy"
              onPress={() => setLegalModalType('privacy')}
            />
            <SettingsRow
              icon="document-outline"
              label="Terms of Service"
              onPress={() => setLegalModalType('terms')}
            />
          </SettingsSection>
        </Animated.View>

        {/* Danger Zone */}
        <Animated.View entering={FadeInUp.delay(600).duration(400)}>
          <SettingsSection title="Account">
            <SettingsRow
              icon="trash-outline"
              label="Delete Account"
              destructive
              showChevron={false}
              onPress={handleDeleteAccount}
            />
          </SettingsSection>
        </Animated.View>
      </ScrollView>

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
