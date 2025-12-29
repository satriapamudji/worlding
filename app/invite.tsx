import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
  Modal,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { BlurView } from 'expo-blur';
import Animated, { FadeIn, FadeInUp, ZoomIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radius, Spacing, Typography, Shadows } from '@/constants/theme';
import { createInviteCode, getActiveInviteCodes, getInviteUrl, getTimeRemaining } from '@/lib/api/invites';

/**
 * Invite Screen
 *
 * Shown after creating a world to invite friends
 */
export default function InviteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    worldId?: string;
    worldName?: string;
  }>();

  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(false);

  // Load active invite code or create a new one
  const loadInviteCode = useCallback(async () => {
    if (!params.worldId) {
      setError('Invalid world');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const { data: activeCodes, error: activeError } = await getActiveInviteCodes(params.worldId);

    const activeCode = activeCodes[0];
    if (activeCode) {
      setInviteCode(activeCode.code);
      setExpiresAt(activeCode.expires_at);
      setIsLoading(false);
      return;
    }

    const { data, error: codeError } = await createInviteCode(params.worldId);

    if (codeError || !data) {
      setError(codeError || activeError || 'Failed to generate invite code');
      setIsLoading(false);
      return;
    }

    setInviteCode(data.code);
    setExpiresAt(data.expires_at);
    setIsLoading(false);
  }, [params.worldId]);

  useEffect(() => {
    loadInviteCode();
  }, [loadInviteCode]);

  const inviteLink = inviteCode ? getInviteUrl(inviteCode) : '';
  const timeRemaining = expiresAt ? getTimeRemaining(expiresAt) : '';

  const handleCopyLink = async () => {
    if (!inviteLink) return;

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    await Clipboard.setStringAsync(inviteLink);
    setCopied(true);

    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyCode = async () => {
    if (!inviteCode) return;

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    await Clipboard.setStringAsync(inviteCode);
    setCopied(true);

    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!inviteLink) return;

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      await Share.share({
        message: `Join my World "${params.worldName}" on Worlding!\n\nUse code: ${inviteCode}\n\n${inviteLink}`,
        url: inviteLink, // iOS only
      });
    } catch (shareError) {
      console.error('Share error:', shareError);
    }
  };

  const handleDone = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    // Navigate to the world
    router.replace({
      pathname: '/world/[id]',
      params: {
        id: params.worldId || 'new',
        title: params.worldName,
      },
    });
  };

  const handleSkip = () => {
    router.replace('/(tabs)');
  };

  const handleShowQR = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setShowQR(true);
  };

  const handleCloseQR = () => {
    setShowQR(false);
  };

  const handleRetry = () => {
    loadInviteCode();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleSkip} hitSlop={12}>
          <Text style={styles.skipText}>Invite later</Text>
        </Pressable>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Animated.View entering={FadeIn.duration(400)} style={styles.iconContainer}>
          <View style={styles.iconBackground}>
            <Ionicons name="gift" size={40} color={Colors.accent} />
          </View>
        </Animated.View>

        <Animated.Text
          entering={FadeInUp.delay(100).duration(400)}
          style={styles.title}
        >
          {params.worldName || 'World'} created!
        </Animated.Text>

        <Animated.Text
          entering={FadeInUp.delay(200).duration(400)}
          style={styles.subtitle}
        >
          Invite friends to share their photos
        </Animated.Text>

        {/* Loading State */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.accent} />
            <Text style={styles.loadingText}>Loading invite code...</Text>
          </View>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <Animated.View entering={FadeIn} style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={handleRetry} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </Pressable>
          </Animated.View>
        )}

        {/* Invite Code Content */}
        {inviteCode && !isLoading && (
          <>
            {/* Invite Code Box */}
            <Animated.View
              entering={FadeInUp.delay(300).duration(400)}
              style={styles.codeBox}
            >
              <Text style={styles.codeLabel}>Invite Code</Text>
              <Pressable onPress={handleCopyCode} style={styles.codeRow}>
                <Text style={styles.codeText}>{inviteCode}</Text>
                <Ionicons
                  name={copied ? 'checkmark' : 'copy-outline'}
                  size={20}
                  color={copied ? Colors.success : Colors.textSecondary}
                />
              </Pressable>
              <Text style={styles.expiryText}>{timeRemaining}</Text>
            </Animated.View>

            {/* Invite Link Box */}
            <Animated.View
              entering={FadeInUp.delay(350).duration(400)}
              style={styles.linkBox}
            >
              <Text style={styles.linkLabel}>Invite Link</Text>
              <View style={styles.linkRow}>
                <Text style={styles.linkText} numberOfLines={1}>
                  {inviteLink}
                </Text>
                <Pressable
                  onPress={handleCopyLink}
                  style={styles.copyButton}
                  hitSlop={8}
                >
                  <Text style={styles.copyButtonText}>
                    {copied ? 'Copied!' : 'Copy'}
                  </Text>
                </Pressable>
              </View>
            </Animated.View>

            {/* Share Button */}
            <Animated.View
              entering={FadeInUp.delay(400).duration(400)}
              style={styles.shareContainer}
            >
              <Pressable
                onPress={handleShare}
                style={({ pressed }) => [
                  styles.shareButton,
                  pressed && styles.shareButtonPressed,
                ]}
              >
                <Text style={styles.shareButtonText}>Share Invite</Text>
              </Pressable>
            </Animated.View>

            {/* Show QR Button */}
            <Animated.View
              entering={FadeInUp.delay(450).duration(400)}
              style={styles.scanContainer}
            >
              <Pressable
                onPress={handleShowQR}
                style={({ pressed }) => [
                  styles.scanButton,
                  pressed && styles.scanButtonPressed,
                ]}
              >
                <Ionicons name="qr-code-outline" size={20} color={Colors.textPrimary} />
                <Text style={styles.scanButtonText}>Show QR Code</Text>
              </Pressable>
            </Animated.View>

            {/* Or divider */}
            <Animated.View
              entering={FadeInUp.delay(500).duration(400)}
              style={styles.dividerRow}
            >
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </Animated.View>

            {/* Done Button */}
            <Animated.View entering={FadeInUp.delay(600).duration(400)}>
              <Pressable
                onPress={handleDone}
                style={({ pressed }) => [
                  styles.doneButton,
                  pressed && styles.doneButtonPressed,
                ]}
              >
                <Text style={styles.doneButtonText}>Go to World</Text>
              </Pressable>
            </Animated.View>
          </>
        )}
      </View>

      {/* Footer hint */}
      <Animated.View
        entering={FadeIn.delay(700).duration(400)}
        style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}
      >
        <Text style={styles.footerText}>
          You can always invite more people later from the world settings
        </Text>
      </Animated.View>

      {/* QR Code Modal */}
      <Modal
        visible={showQR}
        transparent
        animationType="fade"
        onRequestClose={handleCloseQR}
        statusBarTranslucent
      >
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill}>
          <Pressable style={styles.modalOverlay} onPress={handleCloseQR}>
            <Animated.View 
              entering={ZoomIn.duration(300)} 
              exiting={FadeOut.duration(200)}
              style={styles.modalContent}
            >
              <Pressable style={styles.modalInner} onPress={e => e.stopPropagation()}>
                <Text style={styles.qrTitle}>Scan to Join</Text>
                
                <View style={styles.qrContainer}>
                  {inviteLink ? (
                    <QRCode
                      value={inviteLink}
                      size={200}
                      color="black"
                      backgroundColor="white"
                    />
                  ) : null}
                </View>

                <Text style={styles.qrWorldName}>
                  {params.worldName || 'World'}
                </Text>
                <Text style={styles.qrSubtitle}>
                  Invite Code: {inviteCode}
                </Text>

                <Pressable
                  onPress={handleCloseQR}
                  style={({ pressed }) => [
                    styles.closeButton,
                    pressed && styles.closeButtonPressed,
                  ]}
                >
                  <Ionicons name="close" size={24} color={Colors.textPrimary} />
                </Pressable>
              </Pressable>
            </Animated.View>
          </Pressable>
        </BlurView>
      </Modal>
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
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  skipText: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.md,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginBottom: Spacing.lg,
  },
  iconBackground: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.glass,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.md,
    textAlign: 'center',
    marginBottom: Spacing.xxl,
  },
  loadingContainer: {
    alignItems: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.md,
  },
  errorContainer: {
    alignItems: 'center',
    gap: Spacing.md,
  },
  errorText: {
    color: Colors.error,
    fontSize: Typography.sizes.md,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
  },
  retryButtonText: {
    color: Colors.accent,
    fontSize: Typography.sizes.md,
    fontWeight: '600',
  },
  codeBox: {
    width: '100%',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    alignItems: 'center',
  },
  codeLabel: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.xs,
    fontWeight: '500',
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  codeText: {
    color: Colors.textPrimary,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 4,
  },
  expiryText: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.sm,
    marginTop: Spacing.sm,
  },
  linkBox: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  linkLabel: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.xs,
    fontWeight: '500',
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  linkText: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: Typography.sizes.md,
  },
  copyButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
  },
  copyButtonText: {
    color: Colors.accent,
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
  },
  shareContainer: {
    width: '100%',
    marginBottom: Spacing.lg,
  },
  shareButton: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  shareButtonPressed: {
    opacity: 0.9,
  },
  shareButtonText: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.lg,
    fontWeight: '600',
  },
  scanContainer: {
    width: '100%',
    marginBottom: Spacing.lg,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.glass,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    paddingVertical: Spacing.md,
  },
  scanButtonPressed: {
    opacity: 0.8,
  },
  scanButtonText: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.md,
    fontWeight: '500',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: Spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.sm,
    paddingHorizontal: Spacing.md,
  },
  doneButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  doneButtonPressed: {
    opacity: 0.7,
  },
  doneButtonText: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.md,
    fontWeight: '500',
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
  },
  footerText: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.sm,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    ...Shadows.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  modalInner: {
    alignItems: 'center',
    width: '100%',
  },
  qrTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.xl,
    fontWeight: '700',
    marginBottom: Spacing.lg,
  },
  qrContainer: {
    padding: Spacing.lg,
    backgroundColor: 'white',
    borderRadius: Radius.lg,
    marginBottom: Spacing.lg,
    ...Shadows.md,
  },
  qrWorldName: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.lg,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  qrSubtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.sm,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  closeButtonPressed: {
    backgroundColor: Colors.border,
  },
});
