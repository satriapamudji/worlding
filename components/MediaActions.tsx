/**
 * MediaActions - Bottom sheet with media actions
 * 
 * Features:
 * - Share media
 * - Save to camera roll
 * - Delete (owner only)
 * - Glassmorphic design
 */

import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import type { Photo } from '@/constants/mockData';
import { deleteMedia, saveMediaToCameraRoll, shareMedia } from '@/lib/media-utils';

interface MediaActionsProps {
  media: Photo;
  isOwner: boolean;
  isOpen: boolean;
  onClose: () => void;
  onDelete?: () => void;
}

type ActionState = 'idle' | 'loading' | 'success' | 'error';

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  variant?: 'default' | 'danger';
  state?: ActionState;
  disabled?: boolean;
}

function ActionButton({
  icon,
  label,
  onPress,
  variant = 'default',
  state = 'idle',
  disabled = false,
}: ActionButtonProps) {
  const isDanger = variant === 'danger';
  const isLoading = state === 'loading';

  const handlePress = () => {
    if (disabled || isLoading) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.actionButton,
        pressed && styles.actionButtonPressed,
        disabled && styles.actionButtonDisabled,
      ]}
      disabled={disabled || isLoading}
    >
      <View style={[
        styles.actionIconContainer,
        isDanger && styles.actionIconContainerDanger,
      ]}>
        {isLoading ? (
          <ActivityIndicator size="small" color={isDanger ? Colors.error : Colors.textPrimary} />
        ) : (
          icon
        )}
      </View>
      <Text style={[
        styles.actionLabel,
        isDanger && styles.actionLabelDanger,
      ]}>
        {state === 'success' ? 'Done!' : state === 'error' ? 'Failed' : label}
      </Text>
    </Pressable>
  );
}

/**
 * Share Icon
 */
function ShareIcon() {
  return (
    <View style={styles.shareIconContainer}>
      <View style={styles.shareArrow} />
      <View style={styles.shareBox} />
    </View>
  );
}

/**
 * Download Icon
 */
function DownloadIcon() {
  return (
    <View style={styles.downloadIconContainer}>
      <View style={styles.downloadArrow} />
      <View style={styles.downloadLine} />
    </View>
  );
}

/**
 * Delete Icon
 */
function DeleteIcon() {
  return (
    <View style={styles.deleteIconContainer}>
      <View style={styles.trashTop} />
      <View style={styles.trashBody}>
        <View style={styles.trashLine} />
        <View style={styles.trashLine} />
      </View>
    </View>
  );
}

/**
 * Delete Confirmation Dialog
 */
interface DeleteConfirmProps {
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}

function DeleteConfirmation({ onConfirm, onCancel, isDeleting }: DeleteConfirmProps) {
  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
      style={styles.confirmContainer}
    >
      <Text style={styles.confirmTitle}>Delete this photo?</Text>
      <Text style={styles.confirmMessage}>This action cannot be undone.</Text>
      <View style={styles.confirmButtons}>
        <Pressable
          style={styles.confirmCancelButton}
          onPress={onCancel}
          disabled={isDeleting}
        >
          <Text style={styles.confirmCancelText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={styles.confirmDeleteButton}
          onPress={onConfirm}
          disabled={isDeleting}
        >
          {isDeleting ? (
            <ActivityIndicator size="small" color={Colors.textPrimary} />
          ) : (
            <Text style={styles.confirmDeleteText}>Delete</Text>
          )}
        </Pressable>
      </View>
    </Animated.View>
  );
}

/**
 * MediaActions - Main component
 */
export function MediaActions({
  media,
  isOwner,
  isOpen,
  onClose,
  onDelete,
}: MediaActionsProps) {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['35%'], []);
  
  const [shareState, setShareState] = useState<ActionState>('idle');
  const [saveState, setSaveState] = useState<ActionState>('idle');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Handle sheet state changes
  React.useEffect(() => {
    if (isOpen) {
      bottomSheetRef.current?.expand();
    } else {
      bottomSheetRef.current?.close();
    }
  }, [isOpen]);

  const handleSheetChanges = useCallback((index: number) => {
    if (index === -1) {
      onClose();
      // Reset states when closed
      setShareState('idle');
      setSaveState('idle');
      setShowDeleteConfirm(false);
    }
  }, [onClose]);

  // Render backdrop
  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.7}
      />
    ),
    []
  );

  // Handle share
  const handleShare = async () => {
    setShareState('loading');
    const result = await shareMedia(media);
    setShareState(result.success ? 'success' : 'error');
    
    // Reset state after a delay
    setTimeout(() => setShareState('idle'), 2000);
  };

  // Handle save
  const handleSave = async () => {
    setSaveState('loading');
    const result = await saveMediaToCameraRoll(media);
    setSaveState(result.success ? 'success' : 'error');
    
    if (result.success && Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    
    // Reset state after a delay
    setTimeout(() => setSaveState('idle'), 2000);
  };

  // Handle delete
  const handleDeletePress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    const result = await deleteMedia(media);
    
    if (result.success) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      onDelete?.();
      onClose();
    } else {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
  };

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={snapPoints}
      onChange={handleSheetChanges}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.sheetHandle}
    >
      <BottomSheetView style={styles.contentContainer}>
        {showDeleteConfirm ? (
          <DeleteConfirmation
            onConfirm={handleDeleteConfirm}
            onCancel={handleDeleteCancel}
            isDeleting={isDeleting}
          />
        ) : (
          <View style={styles.actionsContainer}>
            <ActionButton
              icon={<ShareIcon />}
              label="Share"
              onPress={handleShare}
              state={shareState}
            />
            <ActionButton
              icon={<DownloadIcon />}
              label="Save"
              onPress={handleSave}
              state={saveState}
            />
            {isOwner && (
              <ActionButton
                icon={<DeleteIcon />}
                label="Delete"
                onPress={handleDeletePress}
                variant="danger"
              />
            )}
          </View>
        )}
      </BottomSheetView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
  },
  sheetHandle: {
    backgroundColor: Colors.textMuted,
    width: 40,
  },
  contentContainer: {
    flex: 1,
    padding: Spacing.lg,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
  },
  actionButton: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  actionButtonPressed: {
    opacity: 0.7,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.glass,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionIconContainerDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  actionLabel: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.sm,
    fontWeight: '500',
  },
  actionLabelDanger: {
    color: Colors.error,
  },

  // Share icon
  shareIconContainer: {
    width: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareArrow: {
    position: 'absolute',
    top: 0,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: Colors.textPrimary,
  },
  shareBox: {
    position: 'absolute',
    bottom: 0,
    width: 16,
    height: 12,
    borderWidth: 2,
    borderTopWidth: 0,
    borderColor: Colors.textPrimary,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },

  // Download icon
  downloadIconContainer: {
    width: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  downloadArrow: {
    position: 'absolute',
    top: 2,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: Colors.textPrimary,
  },
  downloadLine: {
    position: 'absolute',
    bottom: 0,
    width: 18,
    height: 2,
    backgroundColor: Colors.textPrimary,
    borderRadius: 1,
  },

  // Delete icon
  deleteIconContainer: {
    width: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trashTop: {
    position: 'absolute',
    top: 0,
    width: 18,
    height: 3,
    backgroundColor: Colors.error,
    borderRadius: 1,
  },
  trashBody: {
    position: 'absolute',
    top: 5,
    width: 14,
    height: 14,
    backgroundColor: Colors.error,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 3,
    paddingTop: 2,
  },
  trashLine: {
    width: 2,
    height: 8,
    backgroundColor: Colors.surface,
    borderRadius: 1,
  },

  // Delete confirmation
  confirmContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  confirmTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.lg,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  confirmMessage: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.md,
    marginBottom: Spacing.xl,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
  },
  confirmCancelButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    backgroundColor: Colors.glass,
    borderRadius: Radius.lg,
  },
  confirmCancelText: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.md,
    fontWeight: '600',
  },
  confirmDeleteButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    backgroundColor: Colors.error,
    borderRadius: Radius.lg,
  },
  confirmDeleteText: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.md,
    fontWeight: '600',
  },
});

export default MediaActions;
