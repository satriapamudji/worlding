import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import * as MediaLibrary from 'expo-media-library';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LegalModal } from '@/components/LegalModal';
import { SettingsRow } from '@/components/SettingsRow';
import { SettingsSection } from '@/components/SettingsSection';
import { SettingsToggle } from '@/components/SettingsToggle';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { usePrivacyPrefs } from '@/hooks/usePrivacyPrefs';
import { formatBytes } from '@/lib/api';
import { clearCache, getCacheSize } from '@/lib/cache-utils';

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
const SUPPORT_EMAIL = 'contact@worlding.fun';

export default function PrivacyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { prefs, loading: prefsLoading, updatePrefs } = usePrivacyPrefs();

  // Photo settings
  const [autoSync, setAutoSync] = useState(true);
  const [uploadOriginal, setUploadOriginal] = useState(false);
  const [useCellular, setUseCellular] = useState(false);

  // Profile settings
  const [showActivity, setShowActivity] = useState(true);

  // Legal modal
  const [legalModalType, setLegalModalType] = useState<'terms' | 'privacy' | null>(null);

  // Device data
  const [photoAccessLabel, setPhotoAccessLabel] = useState('Checking...');
  const [cacheSizeBytes, setCacheSizeBytes] = useState<number | null>(null);
  const [cacheLoading, setCacheLoading] = useState(true);
  const [cacheError, setCacheError] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);

  const excludedAlbumCount = prefs.excludedAlbums.length;
  const excludedAlbumLabel = Platform.OS === 'web'
    ? 'Not available'
    : prefsLoading
      ? 'Loading...'
      : excludedAlbumCount === 0
        ? 'None'
        : `${excludedAlbumCount} ${excludedAlbumCount === 1 ? 'album' : 'albums'}`;

  const cacheSizeLabel = Platform.OS === 'web'
    ? 'Not available'
    : cacheLoading
      ? 'Calculating...'
      : cacheError
        ? 'Unavailable'
        : formatBytes(cacheSizeBytes ?? 0);

  const canClearCache = Platform.OS !== 'web'
    && !cacheLoading
    && !cacheError
    && !isClearingCache
    && (cacheSizeBytes ?? 0) > 0;

  const autoSyncDisabled = prefsLoading;
  const uploadSettingsDisabled = prefsLoading || !autoSync;
  const excludedAlbumsDisabled = Platform.OS === 'web';

  useEffect(() => {
    if (prefsLoading) return;
    setAutoSync(prefs.autoSync);
    setUploadOriginal(prefs.uploadOriginal);
    setUseCellular(prefs.useCellular);
    setShowActivity(prefs.showActivity);
  }, [prefs, prefsLoading]);

  const openSystemSettings = useCallback(() => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  }, []);

  const refreshPhotoAccess = useCallback(async () => {
    if (Platform.OS === 'web') {
      setPhotoAccessLabel('Not available');
      return;
    }

    const permission = await MediaLibrary.getPermissionsAsync();

    if (permission.status !== 'granted') {
      setPhotoAccessLabel('No Access');
      return;
    }

    if (permission.accessPrivileges === 'limited') {
      setPhotoAccessLabel('Limited');
      return;
    }

    setPhotoAccessLabel('Full Access');
  }, []);

  const loadCacheSize = useCallback(async () => {
    if (Platform.OS === 'web') {
      setCacheSizeBytes(null);
      setCacheLoading(false);
      setCacheError(false);
      return;
    }

    setCacheLoading(true);
    setCacheError(false);

    try {
      const size = await getCacheSize();
      setCacheSizeBytes(size);
    } catch {
      setCacheError(true);
    } finally {
      setCacheLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshPhotoAccess();
      void loadCacheSize();
    }, [loadCacheSize, refreshPhotoAccess]),
  );

  const handleAutoSyncToggle = useCallback((value: boolean) => {
    setAutoSync(value);
    updatePrefs({ autoSync: value });
  }, [updatePrefs]);

  const handleUploadOriginalToggle = useCallback((value: boolean) => {
    setUploadOriginal(value);
    updatePrefs({ uploadOriginal: value });
  }, [updatePrefs]);

  const handleUseCellularToggle = useCallback((value: boolean) => {
    setUseCellular(value);
    updatePrefs({ useCellular: value });
  }, [updatePrefs]);

  const handleShowActivityToggle = useCallback((value: boolean) => {
    setShowActivity(value);
    updatePrefs({ showActivity: value });
  }, [updatePrefs]);

  const clearCacheFlow = useCallback(async () => {
    setIsClearingCache(true);
    try {
      await clearCache();
      await loadCacheSize();
    } catch {
      Alert.alert('Unable to clear cache', 'Please try again later.');
    } finally {
      setIsClearingCache(false);
    }
  }, [loadCacheSize]);

  const handleClearCache = useCallback(() => {
    if (!canClearCache) return;
    Alert.alert(
      'Clear Cache',
      'This will remove cached photos from your device. Photos will be re-downloaded when you view them.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Cache',
          style: 'destructive',
          onPress: () => {
            void clearCacheFlow();
          },
        },
      ]
    );
  }, [canClearCache, clearCacheFlow]);

  const handleExcludedAlbums = useCallback(() => {
    router.push('/settings/excluded-albums');
  }, [router]);

  const openSupportEmail = useCallback((subject: string, body: string) => {
    const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    Linking.openURL(mailto).catch(() => {
      Alert.alert('Unable to open email app', `Please email us at ${SUPPORT_EMAIL}.`);
    });
  }, []);

  const handleExportData = useCallback(() => {
    const userEmail = user?.email ? ` (${user.email})` : '';
    const body = `Hi Worlding team,\n\nPlease export my data${userEmail}.\n\nThanks.`;
    Alert.alert(
      'Export Your Data',
      'We will send you an email with a download link once your export is ready.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Request Export', onPress: () => openSupportEmail('Data export request', body) },
      ]
    );
  }, [openSupportEmail, user?.email]);

  const handleDeleteAccount = useCallback(() => {
    const userEmail = user?.email ? ` (${user.email})` : '';
    const body = `Hi Worlding team,\n\nPlease delete my account${userEmail}.\n\nI understand this cannot be undone.\n`;
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account, all your Worlds, and photos. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request Deletion',
          style: 'destructive',
          onPress: () => {
            openSupportEmail('Account deletion request', body);
          },
        },
      ]
    );
  }, [openSupportEmail, user?.email]);

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
              onValueChange={handleAutoSyncToggle}
              disabled={autoSyncDisabled}
            />
            <SettingsRow
              icon="folder-open-outline"
              label="Photo Library Access"
              value={photoAccessLabel}
              onPress={openSystemSettings}
              disabled={Platform.OS === 'web'}
            />
            <SettingsRow
              icon="ban-outline"
              label="Excluded Albums"
              value={excludedAlbumLabel}
              onPress={excludedAlbumsDisabled ? undefined : handleExcludedAlbums}
              disabled={excludedAlbumsDisabled}
            />
          </SettingsSection>
        </Animated.View>

        {/* Upload Settings */}
        <Animated.View entering={FadeInUp.delay(200).duration(400)}>
          <SettingsSection
            title="Upload"
            footer={uploadOriginal
              ? 'Original photos use more data and storage but preserve full quality.'
              : 'Optimized photos are smaller but still high quality.'
            }
          >
            <SettingsToggle
              icon="image-outline"
              label="Upload Original Quality"
              description="Use full resolution photos"
              value={uploadOriginal}
              onValueChange={handleUploadOriginalToggle}
              disabled={uploadSettingsDisabled}
            />
            <SettingsToggle
              icon="cellular-outline"
              label="Use Cellular Data"
              description="Sync photos over mobile data"
              value={useCellular}
              onValueChange={handleUseCellularToggle}
              disabled={uploadSettingsDisabled}
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
              value={cacheSizeLabel}
              showChevron={false}
            />
            <SettingsRow
              icon="trash-outline"
              label="Clear Cache"
              value={isClearingCache ? 'Clearing...' : undefined}
              onPress={handleClearCache}
              disabled={!canClearCache}
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
              onValueChange={handleShowActivityToggle}
              disabled={prefsLoading}
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
