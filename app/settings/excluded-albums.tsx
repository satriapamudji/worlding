import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import * as MediaLibrary from 'expo-media-library';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SettingsRow, SettingsSection, SettingsToggle } from '@/components';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { usePrivacyPrefs } from '@/hooks/usePrivacyPrefs';

type PermissionState = MediaLibrary.PermissionResponse | null;
type AccessCta = {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  disabled?: boolean;
};

export default function ExcludedAlbumsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { prefs, loading: prefsLoading, updatePrefs } = usePrivacyPrefs();

  const [permission, setPermission] = useState<PermissionState>(null);
  const [albums, setAlbums] = useState<MediaLibrary.Album[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const excludedSet = useMemo(
    () => new Set(prefs.excludedAlbums.map((album) => album.id)),
    [prefs.excludedAlbums],
  );

  const openSystemSettings = useCallback(() => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  }, []);

  const loadAlbums = useCallback(async () => {
    if (Platform.OS === 'web') return;
    setIsLoading(true);

    const currentPermission = await MediaLibrary.getPermissionsAsync();
    setPermission(currentPermission);

    if (currentPermission.status !== 'granted') {
      setAlbums([]);
      setIsLoading(false);
      return;
    }

    const albumList = await MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true });
    albumList.sort((a, b) => {
      if (b.assetCount !== a.assetCount) return b.assetCount - a.assetCount;
      return a.title.localeCompare(b.title);
    });
    setAlbums(albumList);
    setIsLoading(false);
  }, []);

  const requestPermission = useCallback(async () => {
    if (Platform.OS === 'web') return;
    const nextPermission = await MediaLibrary.requestPermissionsAsync();
    setPermission(nextPermission);
    if (nextPermission.status === 'granted') {
      await loadAlbums();
    }
  }, [loadAlbums]);

  const handleManageAccess = useCallback(async () => {
    if (Platform.OS === 'ios' && typeof MediaLibrary.presentPermissionsPickerAsync === 'function') {
      await MediaLibrary.presentPermissionsPickerAsync();
      await loadAlbums();
      return;
    }

    openSystemSettings();
  }, [loadAlbums, openSystemSettings]);

  useFocusEffect(
    useCallback(() => {
      void loadAlbums();
    }, [loadAlbums]),
  );

  const hasAccess = permission?.status === 'granted';
  const hasLimitedAccess = hasAccess && permission?.accessPrivileges === 'limited';

  const accessStatusLabel = useMemo(() => {
    if (Platform.OS === 'web') return 'Not available';
    if (!permission) return 'Checking...';
    if (permission.status !== 'granted') return 'No Access';
    if (permission.accessPrivileges === 'limited') {
      return Platform.OS === 'ios' ? 'Limited Access' : 'Selected Photos';
    }
    if (permission.accessPrivileges === 'none') return 'No Access';
    return 'Full Access';
  }, [permission]);

  const accessFooter = useMemo(() => {
    if (Platform.OS === 'web') return undefined;
    if (!permission) return 'Checking photo access...';
    if (permission.status !== 'granted') {
      return 'Worlding needs photo access to list your albums.';
    }
    if (permission.accessPrivileges === 'limited') {
      return Platform.OS === 'ios'
        ? 'Only selected photos are visible. Add more to manage exclusions.'
        : 'Only selected photos are visible. Open settings to grant full access.';
    }
    return undefined;
  }, [permission]);

  const accessCta = useMemo<AccessCta | null>(() => {
    if (Platform.OS === 'web') return null;
    if (!permission) {
      return {
        label: 'Allow Photo Access',
        icon: 'lock-open-outline',
        onPress: requestPermission,
        disabled: true,
      };
    }
    if (permission.status !== 'granted') {
      if (permission.canAskAgain === false) {
        return {
          label: 'Open System Settings',
          icon: 'settings-outline',
          onPress: openSystemSettings,
        };
      }
      return {
        label: 'Allow Photo Access',
        icon: 'lock-open-outline',
        onPress: requestPermission,
      };
    }
    if (permission.accessPrivileges === 'limited') {
      if (Platform.OS === 'ios') {
        return {
          label: 'Manage Access',
          icon: 'options-outline',
          onPress: handleManageAccess,
        };
      }
      return {
        label: 'Open Settings',
        icon: 'settings-outline',
        onPress: openSystemSettings,
      };
    }
    return {
      label: 'Open System Settings',
      icon: 'settings-outline',
      onPress: openSystemSettings,
    };
  }, [handleManageAccess, openSystemSettings, permission, requestPermission]);

  const missingExcluded = useMemo(() => {
    if (!hasAccess) return [];
    const currentIds = new Set(albums.map((album) => album.id));
    return prefs.excludedAlbums.filter((album) => !currentIds.has(album.id));
  }, [albums, hasAccess, prefs.excludedAlbums]);

  const handleAlbumToggle = useCallback(
    (album: MediaLibrary.Album, value: boolean) => {
      const next = value
        ? [
            ...prefs.excludedAlbums.filter((item) => item.id !== album.id),
            { id: album.id, title: album.title },
          ]
        : prefs.excludedAlbums.filter((item) => item.id !== album.id);
      updatePrefs({ excludedAlbums: next });
    },
    [prefs.excludedAlbums, updatePrefs],
  );

  const handleRemoveMissingAlbum = useCallback((albumId: string) => {
    const next = prefs.excludedAlbums.filter((album) => album.id !== albumId);
    updatePrefs({ excludedAlbums: next });
  }, [prefs.excludedAlbums, updatePrefs]);

  const renderWebState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Ionicons name="phone-portrait-outline" size={32} color={Colors.textMuted} />
      </View>
      <Text style={styles.emptyTitle}>Available on mobile</Text>
      <Text style={styles.emptySubtitle}>
        Album exclusions can be managed on iOS and Android.
      </Text>
    </View>
  );

  const renderAccessSection = () => (
    <Animated.View entering={FadeInUp.delay(100).duration(400)}>
      <SettingsSection title="Photo Access" footer={accessFooter}>
        <SettingsRow
          icon="shield-checkmark-outline"
          label="Access Status"
          value={accessStatusLabel}
          showChevron={false}
        />
        {accessCta && (
          <SettingsRow
            icon={accessCta.icon}
            label={accessCta.label}
            onPress={accessCta.onPress}
            disabled={accessCta.disabled || isLoading}
          />
        )}
      </SettingsSection>
    </Animated.View>
  );

  const renderLimitedBanner = () => (
    <Animated.View entering={FadeInUp.delay(140).duration(400)} style={styles.limitedBanner}>
      <View style={styles.limitedBannerContent}>
        <View style={styles.limitedIcon}>
          <Ionicons name="alert-circle-outline" size={18} color={Colors.warning} />
        </View>
        <View style={styles.limitedText}>
          <Text style={styles.limitedTitle}>
            {Platform.OS === 'ios' ? 'Limited photo access' : 'Selected photos only'}
          </Text>
          <Text style={styles.limitedMessage}>
            {Platform.OS === 'ios'
              ? 'Only selected photos are visible. Add more to manage exclusions.'
              : 'Only selected photos are visible. Open settings to grant full access.'
            }
          </Text>
        </View>
      </View>
      {accessCta && (
        <Pressable
          style={[
            styles.limitedButton,
            (accessCta.disabled || isLoading) && styles.limitedButtonDisabled,
          ]}
          onPress={accessCta.onPress}
          disabled={accessCta.disabled || isLoading}
        >
          <Text style={styles.limitedButtonText}>{accessCta.label}</Text>
        </Pressable>
      )}
    </Animated.View>
  );

  const renderMissingAlbums = () => (
    <Animated.View entering={FadeInUp.delay(180).duration(400)}>
      <SettingsSection
        title="Unavailable Albums"
        footer="Tap an unavailable album to remove it from exclusions."
      >
        {missingExcluded.map((album) => (
          <SettingsRow
            key={album.id}
            icon="alert-circle-outline"
            label={album.title || 'Unknown album'}
            value="Unavailable"
            showChevron={false}
            onPress={() => handleRemoveMissingAlbum(album.id)}
            disabled={prefsLoading}
          />
        ))}
      </SettingsSection>
    </Animated.View>
  );

  const renderAlbumList = () => (
    <Animated.View entering={FadeInUp.delay(150).duration(400)}>
      <SettingsSection
        title="Excluded Albums"
        footer="Toggle albums to skip them during auto-sync."
      >
        {albums.map((album) => (
          <SettingsToggle
            key={album.id}
            icon="images-outline"
            label={album.title}
            description={`${album.assetCount} ${album.assetCount === 1 ? 'item' : 'items'}`}
            value={excludedSet.has(album.id)}
            onValueChange={(value) => handleAlbumToggle(album, value)}
            disabled={prefsLoading}
          />
        ))}
      </SettingsSection>
    </Animated.View>
  );

  const renderEmptyAlbums = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Ionicons name="albums-outline" size={32} color={Colors.textMuted} />
      </View>
      <Text style={styles.emptyTitle}>No albums found</Text>
      <Text style={styles.emptySubtitle}>
        Create albums in your Photos app to manage exclusions here.
      </Text>
    </View>
  );

  const renderPermissionState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Ionicons name="images-outline" size={32} color={Colors.textMuted} />
      </View>
      <Text style={styles.emptyTitle}>Photo access required</Text>
      <Text style={styles.emptySubtitle}>
        Enable photo access to manage your excluded albums.
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Excluded Albums</Text>
        <View style={styles.placeholder} />
      </Animated.View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {Platform.OS === 'web' && renderWebState()}
        {Platform.OS !== 'web' && renderAccessSection()}
        {Platform.OS !== 'web' && hasLimitedAccess && renderLimitedBanner()}
        {Platform.OS !== 'web' && isLoading && (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={Colors.accent} />
            <Text style={styles.loadingText}>Loading albums...</Text>
          </View>
        )}
        {Platform.OS !== 'web' && !isLoading && permission?.status !== 'granted' && renderPermissionState()}
        {Platform.OS !== 'web' && !isLoading && permission?.status === 'granted' && (
          missingExcluded.length > 0 && renderMissingAlbums()
        )}
        {Platform.OS !== 'web' && !isLoading && permission?.status === 'granted' && (
          albums.length > 0 ? renderAlbumList() : renderEmptyAlbums()
        )}
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
  loadingState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.sm,
    marginTop: Spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.lg,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.sm,
    textAlign: 'center',
    lineHeight: Typography.sizes.sm * 1.5,
  },
  limitedBanner: {
    backgroundColor: Colors.glass,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  limitedBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  limitedIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  limitedText: {
    flex: 1,
  },
  limitedTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  limitedMessage: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.xs,
    lineHeight: Typography.sizes.xs * 1.5,
  },
  limitedButton: {
    alignSelf: 'flex-start',
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    backgroundColor: Colors.accent,
  },
  limitedButtonDisabled: {
    opacity: 0.6,
  },
  limitedButtonText: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.xs,
    fontWeight: '600',
  },
});
