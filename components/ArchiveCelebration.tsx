import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  Modal,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, {
  FadeIn,
  FadeOut,
  FadeInDown,
  FadeInUp,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withDelay,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { Colors, Radius, Spacing, Typography, Shadows } from '@/constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ArchiveCelebrationProps {
  visible: boolean;
  worldTitle: string;
  photoCount: number;
  memberCount: number;
  onDismiss: () => void;
  onRelive: () => void;
}

/**
 * Archive Celebration - Celebratory modal when a World is archived
 *
 * Features:
 * - Confetti/sparkle animation
 * - Stats summary (photos, members, days)
 * - "Relive" CTA
 * - Haptic feedback
 */

// Confetti particle component
function ConfettiParticle({ index, color }: { index: number; color: string }) {
  const translateY = useSharedValue(-50);
  const translateX = useSharedValue(0);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);

  useEffect(() => {
    const startX = (Math.random() - 0.5) * SCREEN_WIDTH;
    const endX = startX + (Math.random() - 0.5) * 100;
    const delay = index * 50;

    translateX.value = startX;
    translateY.value = withDelay(
      delay,
      withTiming(SCREEN_HEIGHT + 100, {
        duration: 3000 + Math.random() * 2000,
        easing: Easing.linear,
      })
    );
    translateX.value = withDelay(
      delay,
      withTiming(endX, {
        duration: 3000 + Math.random() * 2000,
        easing: Easing.linear,
      })
    );
    rotate.value = withDelay(
      delay,
      withRepeat(
        withTiming(360, { duration: 1000 + Math.random() * 1000 }),
        -1,
        false
      )
    );
    opacity.value = withDelay(
      2000 + delay,
      withTiming(0, { duration: 1000 })
    );
    scale.value = withDelay(
      delay,
      withSequence(
        withTiming(1.2, { duration: 200 }),
        withTiming(0.8, { duration: 200 }),
        withTiming(1, { duration: 200 })
      )
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  const size = 8 + Math.random() * 8;
  const shapes = ['circle', 'square', 'triangle'];
  const shape = shapes[index % shapes.length];

  return (
    <Animated.View
      style={[
        styles.confettiParticle,
        animatedStyle,
        {
          width: size,
          height: size,
          backgroundColor: shape !== 'triangle' ? color : 'transparent',
          borderRadius: shape === 'circle' ? size / 2 : 2,
          borderLeftWidth: shape === 'triangle' ? size / 2 : 0,
          borderRightWidth: shape === 'triangle' ? size / 2 : 0,
          borderBottomWidth: shape === 'triangle' ? size : 0,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: shape === 'triangle' ? color : 'transparent',
        },
      ]}
    />
  );
}

export function ArchiveCelebration({
  visible,
  worldTitle,
  photoCount,
  memberCount,
  onDismiss,
  onRelive,
}: ArchiveCelebrationProps) {
  const buttonScale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.5);

  useEffect(() => {
    if (visible && Platform.OS !== 'web') {
      // Celebratory haptic pattern
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }, 200);
      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }, 400);
    }
  }, [visible]);

  useEffect(() => {
    if (visible) {
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.8, { duration: 1000 }),
          withTiming(0.4, { duration: 1000 })
        ),
        -1,
        true
      );
    }
  }, [visible]);

  const handleRelive = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onRelive();
  };

  const handleDismiss = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onDismiss();
  };

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const confettiColors = [
    Colors.accent,
    '#FFD700', // Gold
    '#10B981', // Green
    '#6366F1', // Indigo
    '#EC4899', // Pink
    '#F59E0B', // Amber
  ];

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      <Animated.View
        entering={FadeIn.duration(300)}
        style={styles.overlay}
      >
        <BlurView intensity={40} tint="dark" style={styles.blur}>
          {/* Confetti */}
          <View style={styles.confettiContainer}>
            {Array.from({ length: 50 }).map((_, i) => (
              <ConfettiParticle
                key={i}
                index={i}
                color={confettiColors[i % confettiColors.length]}
              />
            ))}
          </View>

          {/* Content Card */}
          <Animated.View
            entering={ZoomIn.delay(200).springify()}
            style={styles.card}
          >
            {/* Glow effect */}
            <Animated.View style={[styles.glow, glowStyle]} />

            {/* Trophy/celebration icon */}
            <Animated.View
              entering={FadeInDown.delay(400).springify()}
              style={styles.iconContainer}
            >
              <LinearGradient
                colors={[Colors.accent, Colors.accentDark]}
                style={styles.iconGradient}
              >
                <View style={styles.trophyIcon}>
                  <View style={styles.trophyCup} />
                  <View style={styles.trophyBase} />
                  <View style={styles.trophyHandle1} />
                  <View style={styles.trophyHandle2} />
                </View>
              </LinearGradient>
            </Animated.View>

            {/* Title */}
            <Animated.Text
              entering={FadeInUp.delay(500).springify()}
              style={styles.title}
            >
              World Complete!
            </Animated.Text>

            {/* World name */}
            <Animated.Text
              entering={FadeInUp.delay(550).springify()}
              style={styles.worldName}
              numberOfLines={2}
            >
              {worldTitle}
            </Animated.Text>

            {/* Stats */}
            <Animated.View
              entering={FadeInUp.delay(600).springify()}
              style={styles.statsContainer}
            >
              <View style={styles.stat}>
                <Text style={styles.statValue}>{photoCount}</Text>
                <Text style={styles.statLabel}>memories</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statValue}>{memberCount}</Text>
                <Text style={styles.statLabel}>contributors</Text>
              </View>
            </Animated.View>

            {/* Message */}
            <Animated.Text
              entering={FadeInUp.delay(700).springify()}
              style={styles.message}
            >
              Your memories are now preserved forever. Relive them anytime.
            </Animated.Text>

            {/* Buttons */}
            <Animated.View
              entering={FadeInUp.delay(800).springify()}
              style={styles.buttons}
            >
              <Pressable
                onPress={handleRelive}
                onPressIn={() => {
                  buttonScale.value = withSpring(0.95, { damping: 15, stiffness: 400 });
                }}
                onPressOut={() => {
                  buttonScale.value = withSpring(1, { damping: 15, stiffness: 400 });
                }}
              >
                <Animated.View style={buttonAnimatedStyle}>
                  <LinearGradient
                    colors={[Colors.accent, Colors.accentDark]}
                    style={styles.reliveButton}
                  >
                    <View style={styles.playTriangle} />
                    <Text style={styles.reliveButtonText}>Relive This Memory</Text>
                  </LinearGradient>
                </Animated.View>
              </Pressable>

              <Pressable style={styles.dismissButton} onPress={handleDismiss}>
                <Text style={styles.dismissButtonText}>Maybe Later</Text>
              </Pressable>
            </Animated.View>
          </Animated.View>
        </BlurView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  blur: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },

  // Confetti
  confettiContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  confettiParticle: {
    position: 'absolute',
    top: 0,
  },

  // Card
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xxl,
    padding: Spacing.xl,
    alignItems: 'center',
    ...Shadows.lg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    top: -50,
    left: '50%',
    marginLeft: -100,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: Colors.accent,
  },

  // Icon
  iconContainer: {
    marginBottom: Spacing.lg,
    ...Shadows.glow,
  },
  iconGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trophyIcon: {
    width: 36,
    height: 40,
    position: 'relative',
  },
  trophyCup: {
    position: 'absolute',
    top: 0,
    left: 6,
    width: 24,
    height: 24,
    backgroundColor: '#FFD700',
    borderRadius: 4,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  trophyBase: {
    position: 'absolute',
    bottom: 0,
    left: 8,
    width: 20,
    height: 8,
    backgroundColor: '#FFD700',
    borderRadius: 2,
  },
  trophyHandle1: {
    position: 'absolute',
    top: 4,
    left: 0,
    width: 8,
    height: 12,
    borderWidth: 3,
    borderRightWidth: 0,
    borderColor: '#FFD700',
    borderRadius: 4,
  },
  trophyHandle2: {
    position: 'absolute',
    top: 4,
    right: 0,
    width: 8,
    height: 12,
    borderWidth: 3,
    borderLeftWidth: 0,
    borderColor: '#FFD700',
    borderRadius: 4,
  },

  // Text
  title: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.xxl,
    fontWeight: 'bold',
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  worldName: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.lg,
    fontWeight: '600',
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },

  // Stats
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.glass,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.xl,
    fontWeight: 'bold',
  },
  statLabel: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.sm,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.md,
  },

  // Message
  message: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.md,
    textAlign: 'center',
    lineHeight: Typography.sizes.md * 1.5,
    marginBottom: Spacing.xl,
  },

  // Buttons
  buttons: {
    width: '100%',
    gap: Spacing.md,
  },
  reliveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md + 2,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.lg,
    gap: Spacing.md,
  },
  playTriangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderLeftColor: Colors.textPrimary,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  reliveButtonText: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.md,
    fontWeight: '700',
  },
  dismissButton: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  dismissButtonText: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.md,
    fontWeight: '500',
  },
});

export default ArchiveCelebration;
