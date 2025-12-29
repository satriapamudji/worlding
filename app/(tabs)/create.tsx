import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
} from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CalendarRangeSheet } from '@/components/CalendarRangeSheet';
import { ImagePicker } from '@/components';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { createWorld } from '@/lib/api/worlds';

/**
 * Create World Screen
 *
 * Minimal, focused design inspired by Linear/Notion
 */
export default function CreateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const today = new Date();
  const defaultStart = new Date(today);
  defaultStart.setDate(today.getDate() - 7);

  const [worldName, setWorldName] = useState('');
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<Date>(defaultStart);
  const [endDate, setEndDate] = useState<Date>(today);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleCreateWorld = async () => {
    const trimmedName = worldName.trim();
    if (!trimmedName || !isDateRangeValid || isSubmitting) return;

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
        setError(createError || 'Failed to create world');
        setIsSubmitting(false);
        return;
      }

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
      console.error('Create world error:', e);
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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
            <Text style={styles.title}>New World</Text>
          </Animated.View>

          {/* Cover Image Picker */}
          <Animated.View
            entering={FadeInUp.delay(50).duration(400)}
            style={styles.coverSection}
          >
            <Text style={styles.label}>Cover (optional)</Text>
            <ImagePicker
              value={coverUri}
              onChange={setCoverUri}
              placeholder="Add cover photo"
              icon="image-outline"
              size="large"
              shape="square"
              aspect={[16, 9]}
              disabled={isSubmitting}
            />
          </Animated.View>

          {/* Name Input */}
          <Animated.View
            entering={FadeInUp.delay(100).duration(400)}
            style={styles.inputSection}
          >
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Tokyo 2024, Wedding Weekend..."
              placeholderTextColor={Colors.textMuted}
              value={worldName}
              onChangeText={setWorldName}
              autoCapitalize="words"
              autoFocus
              returnKeyType="done"
              editable={!isSubmitting}
            />
          </Animated.View>

          {/* Date Input */}
          <Animated.View
            entering={FadeInUp.delay(200).duration(400)}
            style={styles.inputSection}
          >
            <Text style={styles.label}>Dates</Text>
            <Pressable 
              style={styles.dateButton} 
              onPress={openCalendar}
              disabled={isSubmitting}
            >
              <Text style={styles.dateText}>{formatDateRange()}</Text>
              <Text style={styles.dateChevron}>›</Text>
            </Pressable>
            {!isDateRangeValid && (
              <Text style={styles.errorText}>End date must be after start</Text>
            )}
          </Animated.View>

          {/* Error Message */}
          {error && (
            <Animated.View entering={FadeIn} style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </Animated.View>
          )}

          {/* CTA Button */}
          <Animated.View
            entering={FadeInUp.delay(300).duration(400)}
            style={styles.ctaContainer}
          >
            <Pressable
              onPress={handleCreateWorld}
              disabled={!isValid || isSubmitting}
              style={({ pressed }) => [
                styles.ctaButton,
                pressed && isValid && !isSubmitting && styles.ctaButtonPressed,
              ]}
            >
              {isValid && !isSubmitting ? (
                <LinearGradient
                  colors={[Colors.accent, Colors.accentDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.ctaGradient}
                >
                  <Text style={styles.ctaText}>{ctaLabel}</Text>
                </LinearGradient>
              ) : isSubmitting ? (
                <LinearGradient
                  colors={[Colors.accent, Colors.accentDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.ctaGradient}
                >
                  <ActivityIndicator size="small" color={Colors.textPrimary} />
                </LinearGradient>
              ) : (
                <View style={[styles.ctaGradient, styles.ctaDisabled]}>
                  <Text style={[styles.ctaText, styles.ctaTextDisabled]}>{ctaLabel}</Text>
                </View>
              )}
            </Pressable>

            {/* Subtle hint */}
            <Text style={styles.hint}>
              {isReviewFlow
                ? "We'll find photos from your camera roll"
                : "Invite friends after creating"}
            </Text>
          </Animated.View>
      </ScrollView>

      {/* Calendar Sheet - only render when needed to avoid touch issues */}
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
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },

  // Header
  header: {
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.xl,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -0.5,
  },

  // Cover Section
  coverSection: {
    marginBottom: Spacing.xl,
  },

  // Input Sections
  inputSection: {
    marginBottom: Spacing.xl,
  },
  label: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.sm,
    fontWeight: '500',
    marginBottom: Spacing.sm,
  },
  input: {
    fontSize: 20,
    color: Colors.textPrimary,
    fontWeight: '500',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },

  // Date Button
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dateText: {
    fontSize: 20,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  dateChevron: {
    fontSize: 24,
    color: Colors.textMuted,
  },
  errorContainer: {
    marginBottom: Spacing.md,
  },
  errorText: {
    color: Colors.error,
    fontSize: Typography.sizes.sm,
    marginTop: Spacing.sm,
  },

  // CTA
  ctaContainer: {
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  ctaButton: {
    width: '100%',
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  ctaButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  ctaGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    minHeight: 56,
  },
  ctaDisabled: {
    backgroundColor: Colors.surface,
  },
  ctaText: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.lg,
    fontWeight: '600',
  },
  ctaTextDisabled: {
    color: Colors.textMuted,
  },
  hint: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.sm,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
});
