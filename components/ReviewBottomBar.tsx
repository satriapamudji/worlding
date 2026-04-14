/**
 * ReviewBottomBar Component
 *
 * Fixed bottom action bar for the Review screen.
 * Features full-width coral CTA button with video size warning.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Typography, Radius, Shadows } from '@/constants/theme';

/** Threshold for video size warning (50MB in bytes) */
const VIDEO_SIZE_WARNING_THRESHOLD = 50 * 1024 * 1024;

interface ReviewBottomBarProps {
  /** Number of selected photos */
  selectedCount: number;
  /** Total size of selected videos in bytes */
  totalVideoSize: number;
  /** Handler for the "Add Photos" button */
  onAddPhotos: () => void;
  /** Whether the button should be disabled */
  disabled: boolean;
  /** Whether upload is in progress */
  uploading?: boolean;
}

export function ReviewBottomBar({
  selectedCount,
  totalVideoSize,
  onAddPhotos,
  disabled,
  uploading = false,
}: ReviewBottomBarProps) {
  const insets = useSafeAreaInsets();
  const showVideoWarning = totalVideoSize > VIDEO_SIZE_WARNING_THRESHOLD;

  const buttonText = uploading
    ? 'Uploading...'
    : selectedCount === 0
    ? 'Select photos to add'
    : selectedCount === 1
    ? 'Add 1 Photo'
    : `Add ${selectedCount} Photos`;

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
      {/* Privacy badge */}
      <View style={styles.privacyBadge}>
        <Ionicons name="lock-closed" size={12} color={Colors.textMuted} />
        <Text style={styles.privacyText}>Only selected photos are uploaded</Text>
      </View>

      {/* Video size warning */}
      {showVideoWarning && (
        <View style={styles.warningBadge}>
          <Ionicons name="warning" size={14} color={Colors.warning} />
          <Text style={styles.warningText}>
            Large videos may take a while to upload ({formatFileSize(totalVideoSize)})
          </Text>
        </View>
      )}

      {/* Main CTA button */}
      <TouchableOpacity
        onPress={onAddPhotos}
        disabled={disabled || uploading}
        activeOpacity={0.8}
        style={styles.buttonWrapper}
      >
        <LinearGradient
          colors={
            disabled || uploading
              ? [Colors.surface, Colors.surface]
              : [Colors.accent, Colors.accentDark]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.button, (disabled || uploading) && styles.buttonDisabled]}
        >
          {uploading ? (
            <Ionicons name="cloud-upload" size={20} color={Colors.textSecondary} />
          ) : (
            <Ionicons
              name="add-circle"
              size={20}
              color={disabled ? Colors.textMuted : Colors.textPrimary}
            />
          )}
          <Text
            style={[
              styles.buttonText,
              (disabled || uploading) && styles.buttonTextDisabled,
            ]}
          >
            {buttonText}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  privacyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  privacyText: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
  },
  warningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  warningText: {
    fontSize: Typography.sizes.xs,
    color: Colors.warning,
  },
  buttonWrapper: {
    ...Shadows.glowSubtle,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: Radius.lg,
    gap: Spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: Typography.sizes.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  buttonTextDisabled: {
    color: Colors.textMuted,
  },
});
