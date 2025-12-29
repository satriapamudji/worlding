import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Dimensions,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import Animated, { FadeIn, FadeInUp, Layout, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Button } from '@/components';
import { Colors, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { validateInviteCode, joinWorldWithCode } from '@/lib/api/invites';
import type { InviteValidationResult } from '@/lib/database.types';

type JoinState = 'entry' | 'loading' | 'valid' | 'invalid' | 'already_member';

const { width } = Dimensions.get('window');

/**
 * Join World Screen
 *
 * Premium redesign featuring:
 * - Glassmorphic UI
 * - Ambient lighting effects
 * - Smooth Layout animations
 * - Haptic feedback integration
 */
export default function JoinScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ code?: string }>();

  const [state, setState] = useState<JoinState>('loading');
  const [worldInfo, setWorldInfo] = useState<InviteValidationResult | null>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);

  const normalizeInviteCode = useCallback((value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) return '';

    // Handle full URLs
    const urlMatch = trimmed.match(/invite\/([A-Za-z0-9]+)/);
    if (urlMatch) {
      return urlMatch[1].toUpperCase();
    }

    // Clean standard input
    const cleaned = trimmed.replace(/[^A-Za-z0-9]/g, '');
    return cleaned.toUpperCase();
  }, []);

  const isCodeReady = normalizeInviteCode(inviteCode).length >= 6;

  const validateCode = useCallback(async (code: string) => {
    setState('loading');
    setJoinError(null);

    const { data, error } = await validateInviteCode(code);

    if (error || !data) {
      setWorldInfo(null);
      setState('invalid');
      return;
    }

    setWorldInfo(data);

    if (!data.valid) {
      if (data.error_message?.includes('already')) {
        setState('already_member');
      } else {
        setState('invalid');
      }
    } else {
      setState('valid');
    }
  }, []);

  // Fetch world info from invite code (if provided via params)
  useEffect(() => {
    const rawParam = Array.isArray(params.code) ? params.code[0] : params.code;
    if (!rawParam) {
      setWorldInfo(null);
      setActiveCode(null);
      setJoinError(null);
      setState('entry');
      return;
    }

    const normalized = normalizeInviteCode(rawParam);
    if (!normalized) {
      setWorldInfo(null);
      setActiveCode(null);
      setJoinError(null);
      setState('entry');
      return;
    }

    setInviteCode(normalized);
    setActiveCode(normalized);
    void validateCode(normalized);
  }, [normalizeInviteCode, params.code, validateCode]);

  const triggerHaptic = useCallback((style: Haptics.ImpactFeedbackStyle) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(style);
    }
  }, []);

  const handleClose = useCallback(() => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  }, [router, triggerHaptic]);

  const handleJoin = useCallback(async () => {
    if (!activeCode) return;

    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    setIsJoining(true);
    setJoinError(null);

    const { data, error } = await joinWorldWithCode(activeCode);

    if (error || !data) {
      setJoinError(error || 'Failed to join world');
      setIsJoining(false);
      return;
    }

    if (data.success && data.world_id) {
      // Navigate to the newly joined world
      router.replace({
        pathname: '/world/[id]',
        params: {
          id: data.world_id,
          title: worldInfo?.world_title || 'World',
        },
      });
    } else {
      setJoinError(data.error_message || 'Unable to join world');
      setIsJoining(false);
    }
  }, [activeCode, router, triggerHaptic, worldInfo]);

  const handleGoToWorld = useCallback(() => {
    if (!worldInfo?.world_id) return;
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    router.replace({
      pathname: '/world/[id]',
      params: {
        id: worldInfo.world_id,
        title: worldInfo.world_title || 'World',
      },
    });
  }, [router, triggerHaptic, worldInfo]);

  const handleCodeChange = useCallback((value: string) => {
    setInviteCode(value);
    if (inputError) {
      setInputError(null);
    }
  }, [inputError]);

  const handleSubmitCode = useCallback(async () => {
    Keyboard.dismiss();
    const normalized = normalizeInviteCode(inviteCode);
    if (!normalized || normalized.length < 6) {
      setInputError('Enter a valid invite code');
      triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
      return;
    }

    setInputError(null);
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    setActiveCode(normalized);
    await validateCode(normalized);
  }, [inviteCode, normalizeInviteCode, triggerHaptic, validateCode]);

  const handleScanPress = useCallback(() => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    router.push('/scan');
  }, [router, triggerHaptic]);

  const handleTryAnother = useCallback(() => {
    setInviteCode('');
    setWorldInfo(null);
    setJoinError(null);
    setInputError(null);
    setActiveCode(null);
    setState('entry');
  }, []);

  // Render loading state
  const renderLoading = () => (
    <Animated.View entering={FadeIn.duration(300)} style={styles.centerContent}>
      <ActivityIndicator size="large" color={Colors.accent} />
      <Text style={styles.loadingText}>Verifying invite...</Text>
    </Animated.View>
  );

  // Render invalid/expired state
  const renderInvalid = () => (
    <Animated.View entering={FadeIn.duration(400)} layout={Layout.springify()} style={styles.centerContent}>
      <View style={styles.floatingCard}>
        <View style={styles.iconContainer}>
          <View style={[styles.iconBackground, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
            <Ionicons name="alert-circle" size={40} color={Colors.error} />
          </View>
        </View>

        <Text style={styles.errorTitle}>Invalid Invite</Text>

        <Text style={styles.errorText}>
          {worldInfo?.error_message || 'This invite link is invalid or has expired.'}
        </Text>

        <View style={styles.buttonContainer}>
          <Button
            title="Try another code"
            onPress={handleTryAnother}
            fullWidth
            haptic={false}
            size="large"
          />
        </View>

        <View style={styles.buttonContainer}>
          <Button
            title="Go Home"
            onPress={handleClose}
            variant="ghost"
            fullWidth
            haptic={false}
            size="large"
          />
        </View>
      </View>
    </Animated.View>
  );

  // Render already member state
  const renderAlreadyMember = () => (
    <Animated.View entering={FadeIn.duration(400)} layout={Layout.springify()} style={styles.centerContent}>
      <View style={styles.floatingCard}>
        <View style={styles.iconContainer}>
          <View style={[styles.iconBackground, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
            <Ionicons name="checkmark-circle" size={40} color={Colors.success} />
          </View>
        </View>

        <Text style={styles.title}>You're in!</Text>
        
        <Text style={styles.subtitle}>
          You are already a member of
        </Text>

        <Text style={styles.worldName}>
          "{worldInfo?.world_title}"
        </Text>

        <View style={styles.buttonContainer}>
          <Button
            title="Enter World"
            onPress={handleGoToWorld}
            fullWidth
            haptic={false}
            size="large"
          />
        </View>
      </View>
    </Animated.View>
  );

  // Render valid invite state
  const renderValid = () => (
    <Animated.View entering={FadeIn.duration(400)} layout={Layout.springify()} style={styles.centerContent}>
      <View style={styles.floatingCard}>
        {/* Photo stack icon */}
        <View style={styles.iconContainer}>
          <View style={styles.photoStackBackground}>
            <View style={styles.photoStack}>
              <View style={[styles.stackedPhoto, styles.stackedPhotoBack]} />
              <View style={[styles.stackedPhoto, styles.stackedPhotoMiddle]} />
              <View style={[styles.stackedPhoto, styles.stackedPhotoFront]}>
                <Ionicons name="images" size={22} color={Colors.textPrimary} />
              </View>
            </View>
          </View>
        </View>

        {/* Invite label */}
        <Text style={styles.inviteLabel}>
          You've been invited to
        </Text>

        {/* World name */}
        <Text style={styles.worldNameHero} numberOfLines={2}>
          {worldInfo?.world_title}
        </Text>

        {/* Creator info */}
        <View style={styles.creatorRow}>
          <Avatar
            name={worldInfo?.creator_name || 'User'}
            uri={worldInfo?.creator_avatar || undefined}
            size="small"
          />
          <Text style={styles.creatorText}>
            Created by <Text style={{fontWeight: '700', color: Colors.textPrimary}}>{worldInfo?.creator_name}</Text>
          </Text>
        </View>

        {/* Member count */}
        <View style={styles.statsContainer}>
            <Ionicons name="people" size={16} color={Colors.textSecondary} />
            <Text style={styles.memberCount}>
                {worldInfo?.member_count || 0} {(worldInfo?.member_count === 1) ? 'member' : 'members'}
            </Text>
        </View>

        {/* Join error */}
        {joinError && (
          <Text style={styles.joinErrorText}>
            {joinError}
          </Text>
        )}

        {/* Join button */}
        <View style={[styles.buttonContainer, { marginTop: Spacing.xl }]}>
          <Button
            title={isJoining ? 'Joining...' : 'Join World'}
            onPress={handleJoin}
            disabled={isJoining}
            fullWidth
            haptic={false}
            size="large"
            icon={
              isJoining ? (
                <ActivityIndicator color={Colors.textPrimary} size="small" />
              ) : undefined
            }
          />
        </View>
      </View>

      {/* Not now link */}
      <Animated.View entering={FadeInUp.delay(350).duration(400)}>
        <Pressable onPress={handleClose} style={styles.notNowButton}>
          <Text style={styles.notNowText}>Not now</Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );

  // Render entry state (manual code input)
  const renderEntry = () => (
    <Animated.View entering={FadeIn.duration(600)} style={styles.centerContent}>
      
      <View style={styles.headerTextContainer}>
        <Animated.Text entering={FadeInUp.delay(100)} style={styles.heroTitle}>
            Join a World
        </Animated.Text>
        <Animated.Text entering={FadeInUp.delay(200)} style={styles.heroSubtitle}>
            Enter your invite code to start collaborating.
        </Animated.Text>
      </View>

      <View style={styles.floatingContainer}>
        <View style={[styles.floatingInputWrapper, isInputFocused && styles.floatingInputWrapperFocused]}>
          <Animated.View 
            style={[
              styles.floatingInputContainer, 
              isInputFocused && styles.floatingInputContainerFocused
            ]}
          >
            <TextInput
              style={styles.floatingInput}
              placeholder="WRLD-CODE"
              placeholderTextColor="rgba(255,255,255,0.2)"
              value={inviteCode}
              onChangeText={handleCodeChange}
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setIsInputFocused(false)}
              autoCapitalize="characters"
              autoCorrect={false}
              keyboardType="visible-password"
              returnKeyType="done"
              maxLength={20}
              onSubmitEditing={handleSubmitCode}
              selectionColor={Colors.accent}
            />
             {inviteCode.length > 0 && (
                <Pressable onPress={() => handleCodeChange('')} style={styles.floatingClearButton}>
                    <Ionicons name="close-circle" size={20} color="rgba(255,255,255,0.3)" />
                </Pressable>
            )}
          </Animated.View>
        </View>

        {inputError && (
          <Animated.Text entering={FadeIn} style={styles.inputErrorText}>{inputError}</Animated.Text>
        )}

        <View style={styles.buttonContainer}>
          <Button
            title="Continue"
            onPress={handleSubmitCode}
            disabled={!isCodeReady}
            fullWidth
            haptic={false}
            size="large"
            variant={isCodeReady ? 'primary' : 'secondary'}
          />
        </View>

        <View style={styles.minimalDivider}>
            <View style={styles.dividerDot} />
        </View>

        <View style={styles.buttonContainer}>
          <Button
            title="Scan QR Code"
            onPress={handleScanPress}
            variant="ghost"
            fullWidth
            haptic={false}
            size="large"
            icon={<Ionicons name="qr-code" size={20} color={Colors.textSecondary} />}
          />
        </View>
      </View>
    </Animated.View>
  );

  const renderContent = () => {
    switch (state) {
      case 'entry':
        return renderEntry();
      case 'loading':
        return renderLoading();
      case 'invalid':
        return renderInvalid();
      case 'already_member':
        return renderAlreadyMember();
      case 'valid':
        return renderValid();
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <LinearGradient
          colors={['#1c1c1e', '#000000']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        
        {/* Background Ambience - Glow effect */}
        <View style={styles.ambientLight} />

        {/* Header */}
        <Animated.View entering={FadeIn.duration(300)} style={[styles.header, { paddingTop: insets.top }]}>
          <Pressable onPress={handleClose} style={styles.closeButton} hitSlop={12}>
            <Ionicons name="close" size={24} color={Colors.textPrimary} />
          </Pressable>
        </Animated.View>

        {/* Content */}
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={styles.keyboardAvoid}
        >
          <View style={[styles.contentContainer, { paddingBottom: insets.bottom + Spacing.lg }]}>
            {renderContent()}
          </View>
        </KeyboardAvoidingView>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardAvoid: {
    flex: 1,
  },
  ambientLight: {
    position: 'absolute',
    top: -100,
    right: -50,
    width: 350,
    height: 350,
    borderRadius: 175,
    backgroundColor: Colors.accent,
    opacity: 0.08,
    transform: [{ scale: 1.5 }],
    // Removed blurRadius to fix type error
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    zIndex: 10,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  cardContent: {
    width: '100%',
    padding: Spacing.xl,
    alignItems: 'center',
    // Ensure card has depth
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },

  // Loading
  loadingText: {
    marginTop: Spacing.lg,
    color: Colors.textSecondary,
    fontSize: Typography.sizes.md,
  },

  // Header Text
  headerTextContainer: {
    marginBottom: Spacing.xxl,
    alignItems: 'center',
    width: '100%',
  },
  heroTitle: {
    color: Colors.textPrimary,
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: Spacing.sm,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.md,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: '80%',
  },

  // Icon container
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
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },

  // Photo stack icon
  photoStackBackground: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.03)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  photoStack: {
    width: 60,
    height: 60,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stackedPhoto: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.md,
  },
  stackedPhotoBack: {
    transform: [{ rotate: '-12deg' }, { scale: 0.9 }],
    opacity: 0.6,
    backgroundColor: '#2A2A2A',
  },
  stackedPhotoMiddle: {
    transform: [{ rotate: '6deg' }, { scale: 0.95 }],
    opacity: 0.8,
    backgroundColor: '#333',
  },
  stackedPhotoFront: {
    transform: [{ rotate: '-2deg' }],
    backgroundColor: Colors.surfaceElevated,
    borderColor: Colors.glassBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },

  // Text styles
  inviteLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: Spacing.sm,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.md,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  worldName: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  worldNameHero: {
    color: Colors.textPrimary,
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: Spacing.md,
    letterSpacing: -0.5,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radius.full,
  },
  creatorText: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.sm,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.md,
  },
  memberCount: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.sm,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    width: '40%',
    backgroundColor: Colors.border,
    marginBottom: Spacing.md,
  },



  inputErrorText: {
    color: Colors.error,
    fontSize: Typography.sizes.sm,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },

  // Error state
  errorTitle: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  errorText: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.md,
    textAlign: 'center',
    marginBottom: Spacing.xxl,
  },
  joinErrorText: {
    color: Colors.error,
    fontSize: Typography.sizes.sm,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },

  // Buttons
  buttonContainer: {
    width: '100%',
    marginBottom: Spacing.sm,
  },
  notNowButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.md,
  },
  notNowText: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.sm,
    fontWeight: '500',
  },

  // Floating Input Styles
  floatingContainer: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    paddingHorizontal: Spacing.sm,
  },
  floatingInputWrapper: {
    marginBottom: Spacing.xl,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  floatingInputWrapperFocused: {
    ...Shadows.glowSubtle,
    shadowOpacity: 0.15,
  },
  floatingInputContainer: {
    height: 68,
    borderRadius: Radius.xl,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  floatingInputContainerFocused: {
    borderColor: 'rgba(255, 87, 61, 0.5)', // Colors.accent with opacity
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  floatingInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 24,
    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace' }),
    fontWeight: '600',
    letterSpacing: 2,
    textAlign: 'center',
  },
  floatingClearButton: {
    padding: Spacing.md,
  },
  minimalDivider: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Spacing.xl,
  },
  dividerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },

  // Floating Card (for valid/invalid states)
  floatingCard: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(20,20,20,0.95)',
    borderRadius: Radius.xxl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: Spacing.xl,
    paddingVertical: Spacing.xxl,
    ...Shadows.lg,
  },
});
