import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
  Image,
  Dimensions,
} from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';

import { CalendarRangeSheet } from '@/components/CalendarRangeSheet';
import { VerifyConnectionSheet } from '@/components/VerifyConnectionSheet';
import { Colors, Radius, Spacing, Typography, Shadows, Layout } from '@/constants/theme';
import { createWorld } from '@/lib/api/worlds';
import { trackEvent } from '@/lib/analytics';
import { logger } from '@/lib/logger';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COVER_HEIGHT = 280;

/**
 * Create World Screen
 *
 * Immersive, "What You See Is What You Get" design.
 * The user edits the world cover directly.
 */
export default function CreateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, refreshProfile } = useAuth();
  const {
    canAccessPaidFeatures,
    needsConnection,
    purchaseSyncStatus,
    refreshEntitlements,
    presentPaywall,
    markPurchaseSyncDelayed,
  } = useSubscription();

  const today = new Date();
  const defaultStart = new Date(today);
  defaultStart.setDate(today.getDate() - 7);

  const [worldName, setWorldName] = useState('');
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<Date>(defaultStart);
  const [endDate, setEndDate] = useState<Date>(today);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showVerifySheet, setShowVerifySheet] = useState(false);

  const [calendarVisible, setCalendarVisible] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(
    new Date(startDate.getFullYear(), startDate.getMonth(), 1)
  );
  const [tempRangeStart, setTempRangeStart] = useState<Date | null>(startDate);
  const [tempRangeEnd, setTempRangeEnd] = useState<Date | null>(endDate);

  const isPostEvent = (): boolean => {
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    return endDate <= todayEnd;
  };

  const isDateRangeValid = startDate <= endDate;
  const ownedWorldsCount = profile?.owned_worlds_count ?? 0;
  const isFirstWorld = ownedWorldsCount < 1;
  const requiresSubscription = !isFirstWorld && !canAccessPaidFeatures;
  const showPaywallHint = !isFirstWorld && !canAccessPaidFeatures;

  // --- Image Picker Logic ---
  const handleCoverPress = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') return;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9], // Cinematic aspect ratio
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setCoverUri(result.assets[0].uri);
      }
    } catch (e) {
      logger.media.warn('Error picking cover image', e);
    }
  };

  const handleCreateWorld = async () => {
    const trimmedName = worldName.trim();
    if (!trimmedName || !isDateRangeValid || isSubmitting) return;

    trackEvent('world_create_attempt', {
      owned_worlds_count: ownedWorldsCount,
      is_first_world: isFirstWorld,
    });

    if (requiresSubscription) {
      if (needsConnection) {
        trackEvent('subscription_verify_required', { reason: 'create_second_world' });
        setShowVerifySheet(true);
        return;
      }

      openPaywall();
      return;
    }

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    setError(null);
    setIsSubmitting(true);

    try {
      // Create world in Supabase
      const { data: world, error: createError } = await createWorld(
        trimmedName,
        startDate.toISOString().split('T')[0], // Format as YYYY-MM-DD
        endDate.toISOString().split('T')[0],
        coverUri
      );

      if (createError || !world) {
        if (createError === 'subscription_required') {
          if (purchaseSyncStatus !== 'idle') {
            markPurchaseSyncDelayed();
            setError('Still syncing your purchase. Please try again in a moment.');
          } else if (needsConnection) {
            trackEvent('subscription_verify_required', { reason: 'create_second_world' });
            setShowVerifySheet(true);
          } else {
            openPaywall();
          }
          setIsSubmitting(false);
          return;
        }

        setError(createError || 'Failed to create world');
        setIsSubmitting(false);
        return;
      }

      trackEvent('world_create_success', {
        world_id: world.id,
        is_first_world: isFirstWorld,
      });
      if (isFirstWorld) {
        trackEvent('first_world_completed', { world_id: world.id });
      }
      await refreshProfile();

      // Navigate based on event timing
      if (isPostEvent()) {
        // Past event - go to photo review first
        router.push({
          pathname: '/review',
          params: {
            worldId: world.id,
            worldName: trimmedName,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
          },
        });
      } else {
        // Future/current event - go to invite screen
        router.push({
          pathname: '/invite',
          params: {
            worldId: world.id,
            worldName: trimmedName,
          },
        });
      }
    } catch (e) {
      logger.world.error('Create world error', e);
      setError('Something went wrong. Please try again.');
      setIsSubmitting(false);
    }
  };

  const openCalendar = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setTempRangeStart(startDate);
    setTempRangeEnd(endDate);
    setCalendarMonth(new Date(startDate.getFullYear(), startDate.getMonth(), 1));
    setCalendarVisible(true);
  };

  const handleCalendarDayPress = (day: Date) => {
    if (!tempRangeStart || (tempRangeStart && tempRangeEnd)) {
      setTempRangeStart(day);
      setTempRangeEnd(null);
      return;
    }

    if (day.getTime() < tempRangeStart.getTime()) {
      setTempRangeStart(day);
      setTempRangeEnd(tempRangeStart);
    } else if (day.getTime() === tempRangeStart.getTime()) {
      setTempRangeEnd(day);
    } else {
      setTempRangeEnd(day);
    }
  };

  const handleCalendarCancel = () => {
    setCalendarVisible(false);
  };

  const handleCalendarConfirm = () => {
    if (!tempRangeStart) {
      setCalendarVisible(false);
      return;
    }

    const finalEnd = tempRangeEnd && tempRangeEnd.getTime() >= tempRangeStart.getTime()
      ? tempRangeEnd
      : tempRangeStart;

    setStartDate(tempRangeStart);
    setEndDate(finalEnd);
    setCalendarVisible(false);
  };

  const handleVerifyRetry = () => {
    setShowVerifySheet(false);
    void refreshEntitlements('verify_retry');
  };

  const openPaywall = () => {
    trackEvent('paywall_triggered', {
      reason: 'create_second_world',
      owned_worlds_count: ownedWorldsCount,
    });

    presentPaywall('create_second_world')
      .then((result) => {
        if (result.status === 'error') {
          router.push({ pathname: '/paywall', params: { reason: 'create_second_world' } });
        }
      })
      .catch(() => {
        router.push({ pathname: '/paywall', params: { reason: 'create_second_world' } });
      });
  };

  const formatDateDisplay = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
    });
  };

  const formatDateRange = () => {
    const start = formatDateDisplay(startDate);
    const end = formatDateDisplay(endDate);
    if (start === end) return start;
    return `${start} – ${end}`;
  };

  const isValid = worldName.trim().length > 0 && isDateRangeValid;
  const isReviewFlow = isPostEvent();
  const ctaLabel = isReviewFlow ? 'Continue' : 'Create World';

  return (
    <View style={styles.container}>
      {/* Immersive Scroll View */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Layout.tabBarHeight + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header / Cover Area */}
        <Animated.View entering={FadeIn.duration(600)} style={styles.coverContainer}>
          <Pressable onPress={handleCoverPress} style={styles.coverPressable}>
            {coverUri ? (
              <Image source={{ uri: coverUri }} style={styles.coverImage} resizeMode="cover" />
            ) : (
              <LinearGradient
                colors={['#2A2A2A', '#1A1A1A']}
                style={styles.coverPlaceholder}
              >
                <View style={styles.addCoverIcon}>
                  <Ionicons name="image-outline" size={32} color={Colors.textSecondary} />
                </View>
                <Text style={styles.addCoverText}>Add Cover Photo</Text>
              </LinearGradient>
            )}
            
            {/* Gradient Overlay for Text Readability */}
            <LinearGradient
              colors={['transparent', 'rgba(5,5,5,0.8)', Colors.background]}
              locations={[0, 0.8, 1]}
              style={styles.gradientOverlay}
            />

            {/* Edit Button (if cover exists) */}
            {coverUri && (
              <View style={styles.editBadge}>
                <Ionicons name="pencil" size={14} color={Colors.textPrimary} />
                <Text style={styles.editBadgeText}>Edit</Text>
              </View>
            )}
          </Pressable>
        </Animated.View>

        {/* Content Area - Floating up slightly */}
        <View style={styles.formContent}>

          {showPaywallHint && (
            <Animated.View entering={FadeInUp.delay(80).duration(400)} style={styles.paywallHint}>
              <View style={styles.paywallHintIcon}>
                <Ionicons name="lock-closed" size={18} color={Colors.accent} />
              </View>
              <View style={styles.paywallHintContent}>
                <Text style={styles.paywallHintTitle}>Worlding+ required</Text>
                <Text style={styles.paywallHintText}>
                  You've used your free World. Keep editing, then unlock Worlding+ to finish.
                </Text>
              </View>
            </Animated.View>
          )}
          
          {/* World Name Input */}
          <Animated.View entering={FadeInUp.delay(100).duration(500)} style={styles.titleInputContainer}>
            <TextInput
              style={styles.titleInput}
              placeholder="Name your World..."
              placeholderTextColor={Colors.textMuted}
              value={worldName}
              onChangeText={setWorldName}
              autoCapitalize="words"
              multiline
              maxLength={50}
              returnKeyType="done"
              editable={!isSubmitting}
            />
          </Animated.View>

          {/* Date Selector */}
          <Animated.View entering={FadeInUp.delay(200).duration(500)} style={styles.dateSection}>
             <Pressable 
              style={styles.dateRow} 
              onPress={openCalendar}
              disabled={isSubmitting}
            >
              <View style={styles.dateIcon}>
                <Ionicons name="calendar-outline" size={20} color={Colors.accent} />
              </View>
              <Text style={styles.dateValue}>{formatDateRange()}</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} style={{ marginLeft: 'auto' }} />
            </Pressable>
            
            {!isDateRangeValid && (
              <Text style={styles.errorText}>End date must be after start</Text>
            )}
          </Animated.View>

          {/* Error Message */}
          {error && (
            <Animated.View entering={FadeIn} style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={16} color={Colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </Animated.View>
          )}

          {/* Hint Text */}
          <Animated.View entering={FadeInUp.delay(400).duration(500)} style={styles.hintContainer}>
             <Text style={styles.hintText}>
              {isReviewFlow
                ? "This looks like a past event. We'll help you find photos from your camera roll."
                : "You can invite friends to join this World after you create it."}
            </Text>
          </Animated.View>

        </View>
      </ScrollView>

      {/* Floating Bottom Bar */}
      <Animated.View 
        entering={FadeInUp.delay(300).duration(500)}
        style={[styles.bottomBar, { bottom: Layout.tabBarHeight, paddingBottom: Math.max(Spacing.lg, insets.bottom) }]}
      >
        <Pressable
          onPress={handleCreateWorld}
          disabled={!isValid || isSubmitting}
          style={({ pressed }) => [
            styles.ctaButton,
            pressed && isValid && !isSubmitting && styles.ctaButtonPressed,
            (!isValid || isSubmitting) && styles.ctaButtonDisabled
          ]}
        >
           {isSubmitting ? (
             <ActivityIndicator color={Colors.textPrimary} />
           ) : (
            <>
              <Text style={[styles.ctaText, !isValid && styles.ctaTextDisabled]}>{ctaLabel}</Text>
              {isValid && <Ionicons name="arrow-forward" size={20} color={Colors.textPrimary} />}
            </>
           )}
        </Pressable>
      </Animated.View>

      {/* Back Button (Fixed) */}
      <Pressable 
        style={[styles.backButton, { top: insets.top + Spacing.sm }]} 
        onPress={() => router.back()}
      >
        <View style={styles.backButtonBlur}>
           <Ionicons name="close" size={24} color={Colors.textPrimary} />
        </View>
      </Pressable>

      {/* Calendar Sheet */}
      {calendarVisible && (
        <CalendarRangeSheet
          visible={calendarVisible}
          month={calendarMonth}
          tempStart={tempRangeStart}
          tempEnd={tempRangeEnd}
          onChangeMonth={setCalendarMonth}
          onDayPress={handleCalendarDayPress}
          onCancel={handleCalendarCancel}
          onConfirm={handleCalendarConfirm}
        />
      )}

      <VerifyConnectionSheet
        visible={showVerifySheet}
        onClose={() => setShowVerifySheet(false)}
        onRetry={handleVerifyRetry}
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
    padding: 0,
  },

  // Cover Area
  coverContainer: {
    height: COVER_HEIGHT,
    width: '100%',
    position: 'relative',
  },
  coverPressable: {
    flex: 1,
    width: '100%',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  addCoverIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  addCoverText: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.sm,
    fontWeight: '500',
  },
  gradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 160,
  },
  editBadge: {
    position: 'absolute',
    top: 20,
    right: 20, // Will be adjusted by safe area in a real header, but we have a custom close button
    marginTop: 40, // Push down a bit
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  editBadgeText: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },

  // Form Content
  formContent: {
    paddingHorizontal: Spacing.lg,
    marginTop: -40, // Pull up into gradient
  },
  paywallHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.glass,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    marginBottom: Spacing.lg,
  },
  paywallHintIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 87, 61, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paywallHintContent: {
    flex: 1,
  },
  paywallHintTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
    marginBottom: 2,
  },
  paywallHintText: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.xs,
    lineHeight: Typography.sizes.xs * 1.4,
  },
  titleInputContainer: {
    marginBottom: Spacing.xl,
  },
  titleInput: {
    fontSize: 40,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -1,
    lineHeight: 48,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },

  // Date Section
  dateSection: {
    marginBottom: Spacing.xl,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  dateIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 87, 61, 0.1)', // Accent tint
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateValue: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.md,
    fontWeight: '600',
  },
  
  // Hint
  hintContainer: {
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  hintText: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.sm,
    lineHeight: 20,
  },

  // Error
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  errorText: {
    color: Colors.error,
    fontSize: Typography.sizes.sm,
  },

  // Bottom Bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
    gap: Spacing.sm,
    ...Shadows.glow,
  },
  ctaButtonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  ctaButtonDisabled: {
    backgroundColor: Colors.surfaceElevated,
    shadowOpacity: 0,
    elevation: 0,
  },
  ctaText: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.md,
    fontWeight: '600',
  },
  ctaTextDisabled: {
    color: Colors.textMuted,
  },

  // Custom Back Button
  backButton: {
    position: 'absolute',
    left: Spacing.lg,
    zIndex: 100,
  },
  backButtonBlur: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
});
