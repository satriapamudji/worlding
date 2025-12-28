import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  Image,
  Platform,
  StatusBar,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSequence,
  withDelay,
  withRepeat,
  interpolate,
  Easing,
  runOnJS,
  cancelAnimation,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { Avatar } from '@/components';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { getWorldById } from '@/constants/mockData';
import type { Photo } from '@/constants/mockData';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PHOTO_DURATION = 4000; // 4 seconds per photo
const TRANSITION_DURATION = 800; // 800ms crossfade

/**
 * Relive Screen - Cinematic photo experience
 *
 * Features:
 * - Ken Burns effect (subtle zoom/pan)
 * - Crossfade transitions between photos
 * - Photo owner attribution
 * - Date/time overlays
 * - Tap to pause/play
 * - Swipe to skip
 */

export default function ReliveScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id: worldId } = useLocalSearchParams<{ id: string }>();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const controlsTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Get world data
  const world = getWorldById(worldId);
  const photos = world?.photos || [];

  // Animation values
  const progress = useSharedValue(0);
  const photoOpacity = useSharedValue(1);
  const kenBurnsScale = useSharedValue(1);
  const kenBurnsX = useSharedValue(0);
  const kenBurnsY = useSharedValue(0);
  const controlsOpacity = useSharedValue(1);

  // Ken Burns effect - random direction for each photo
  const startKenBurns = useCallback(() => {
    const directions = [
      { scale: 1.15, x: 20, y: 10 },
      { scale: 1.12, x: -15, y: 15 },
      { scale: 1.18, x: 10, y: -20 },
      { scale: 1.14, x: -20, y: -10 },
    ];
    const dir = directions[currentIndex % directions.length];

    kenBurnsScale.value = 1;
    kenBurnsX.value = 0;
    kenBurnsY.value = 0;

    kenBurnsScale.value = withTiming(dir.scale, {
      duration: PHOTO_DURATION + TRANSITION_DURATION,
      easing: Easing.linear,
    });
    kenBurnsX.value = withTiming(dir.x, {
      duration: PHOTO_DURATION + TRANSITION_DURATION,
      easing: Easing.linear,
    });
    kenBurnsY.value = withTiming(dir.y, {
      duration: PHOTO_DURATION + TRANSITION_DURATION,
      easing: Easing.linear,
    });
  }, [currentIndex]);

  // Progress to next photo
  const goToNext = useCallback(() => {
    if (currentIndex < photos.length - 1) {
      // Fade out current photo
      photoOpacity.value = withTiming(0, { duration: TRANSITION_DURATION / 2 }, () => {
        runOnJS(setCurrentIndex)(currentIndex + 1);
        // Fade in next photo
        photoOpacity.value = withTiming(1, { duration: TRANSITION_DURATION / 2 });
      });
    } else {
      // End of slideshow - return to world view
      router.back();
    }
  }, [currentIndex, photos.length, router]);

  // Auto-advance timer
  useEffect(() => {
    if (!isPaused && photos.length > 0) {
      startKenBurns();
      timerRef.current = setTimeout(goToNext, PHOTO_DURATION);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [currentIndex, isPaused, photos.length, goToNext, startKenBurns]);

  // Auto-hide controls
  useEffect(() => {
    if (showControls && !isPaused) {
      controlsTimerRef.current = setTimeout(() => {
        controlsOpacity.value = withTiming(0, { duration: 300 });
        setShowControls(false);
      }, 3000);
    }

    return () => {
      if (controlsTimerRef.current) {
        clearTimeout(controlsTimerRef.current);
      }
    };
  }, [showControls, isPaused]);

  const triggerHaptic = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleTap = () => {
    triggerHaptic();

    // Show controls if hidden
    if (!showControls) {
      controlsOpacity.value = withTiming(1, { duration: 200 });
      setShowControls(true);
      return;
    }

    // Toggle pause
    setIsPaused(!isPaused);

    if (!isPaused) {
      // Pausing - cancel timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      cancelAnimation(kenBurnsScale);
      cancelAnimation(kenBurnsX);
      cancelAnimation(kenBurnsY);
    }
  };

  const handleSkip = () => {
    triggerHaptic();
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    goToNext();
  };

  const handlePrevious = () => {
    triggerHaptic();
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    if (currentIndex > 0) {
      photoOpacity.value = withTiming(0, { duration: TRANSITION_DURATION / 2 }, () => {
        runOnJS(setCurrentIndex)(currentIndex - 1);
        photoOpacity.value = withTiming(1, { duration: TRANSITION_DURATION / 2 });
      });
    }
  };

  const handleClose = () => {
    triggerHaptic();
    router.back();
  };

  // Animated styles
  const photoStyle = useAnimatedStyle(() => ({
    opacity: photoOpacity.value,
    transform: [
      { scale: kenBurnsScale.value },
      { translateX: kenBurnsX.value },
      { translateY: kenBurnsY.value },
    ],
  }));

  const controlsStyle = useAnimatedStyle(() => ({
    opacity: controlsOpacity.value,
  }));

  if (!world || photos.length === 0) {
    return (
      <View style={[styles.container, styles.errorContainer]}>
        <Text style={styles.errorText}>No photos to relive</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.errorLink}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const currentPhoto = photos[currentIndex];
  const photoDate = new Date(currentPhoto.timestamp);
  const dateLabel = photoDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const timeLabel = photoDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <View style={styles.container}>
      {/* Photo */}
      <Pressable style={styles.photoContainer} onPress={handleTap}>
        <Animated.View style={[styles.photoWrapper, photoStyle]}>
          <Image
            source={{ uri: currentPhoto.uri }}
            style={styles.photo}
            resizeMode="cover"
          />
        </Animated.View>
      </Pressable>

      {/* Gradient overlays */}
      <LinearGradient
        colors={['rgba(0,0,0,0.7)', 'transparent']}
        style={styles.topGradient}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.8)']}
        style={styles.bottomGradient}
        pointerEvents="none"
      />

      {/* Controls */}
      <Animated.View style={[styles.controls, controlsStyle]} pointerEvents={showControls ? 'auto' : 'none'}>
        {/* Top bar */}
        <View style={[styles.topBar, { paddingTop: insets.top + Spacing.sm }]}>
          <Pressable style={styles.closeButton} onPress={handleClose}>
            <BlurView intensity={40} tint="dark" style={styles.closeButtonBlur}>
              <View style={styles.closeIcon}>
                <View style={styles.closeLine1} />
                <View style={styles.closeLine2} />
              </View>
            </BlurView>
          </Pressable>

          <View style={styles.worldInfo}>
            <Text style={styles.worldTitle} numberOfLines={1}>{world.title}</Text>
            <Text style={styles.photoCounter}>{currentIndex + 1} / {photos.length}</Text>
          </View>

          <View style={styles.placeholder} />
        </View>

        {/* Bottom info */}
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + Spacing.lg }]}>
          {/* Photo info */}
          <View style={styles.photoInfo}>
            <View style={styles.photoOwnerRow}>
              <Avatar
                uri={currentPhoto.owner.avatar}
                name={currentPhoto.owner.name}
                size="medium"
              />
              <View style={styles.ownerInfo}>
                <Text style={styles.ownerName}>{currentPhoto.owner.name}</Text>
                <Text style={styles.photoTime}>{dateLabel} at {timeLabel}</Text>
              </View>
            </View>
          </View>

          {/* Playback controls */}
          <View style={styles.playbackControls}>
            <Pressable style={styles.skipButton} onPress={handlePrevious}>
              <View style={styles.skipIcon}>
                <View style={[styles.skipTriangle, styles.skipTriangleLeft]} />
                <View style={[styles.skipTriangle, styles.skipTriangleLeft]} />
              </View>
            </Pressable>

            <Pressable style={styles.playPauseButton} onPress={handleTap}>
              {isPaused ? (
                <View style={styles.playIcon} />
              ) : (
                <View style={styles.pauseIcon}>
                  <View style={styles.pauseBar} />
                  <View style={styles.pauseBar} />
                </View>
              )}
            </Pressable>

            <Pressable style={styles.skipButton} onPress={handleSkip}>
              <View style={styles.skipIcon}>
                <View style={[styles.skipTriangle, styles.skipTriangleRight]} />
                <View style={[styles.skipTriangle, styles.skipTriangleRight]} />
              </View>
            </Pressable>
          </View>

          {/* Progress bar */}
          <View style={styles.progressContainer}>
            {photos.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.progressDot,
                  index === currentIndex && styles.progressDotActive,
                  index < currentIndex && styles.progressDotCompleted,
                ]}
              />
            ))}
          </View>
        </View>
      </Animated.View>

      {/* Pause indicator */}
      {isPaused && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={styles.pauseIndicator}
        >
          <BlurView intensity={60} tint="dark" style={styles.pauseIndicatorBlur}>
            <View style={styles.pauseIndicatorIcon}>
              <View style={styles.pauseIndicatorBar} />
              <View style={styles.pauseIndicatorBar} />
            </View>
            <Text style={styles.pauseIndicatorText}>Paused</Text>
          </BlurView>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  // Photo
  photoContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  photoWrapper: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  photo: {
    width: '100%',
    height: '100%',
  },

  // Gradients
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 300,
  },

  // Controls
  controls: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  closeButtonBlur: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  closeIcon: {
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeLine1: {
    position: 'absolute',
    width: 16,
    height: 2,
    backgroundColor: Colors.textPrimary,
    borderRadius: 1,
    transform: [{ rotate: '45deg' }],
  },
  closeLine2: {
    position: 'absolute',
    width: 16,
    height: 2,
    backgroundColor: Colors.textPrimary,
    borderRadius: 1,
    transform: [{ rotate: '-45deg' }],
  },
  worldInfo: {
    alignItems: 'center',
  },
  worldTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.md,
    fontWeight: '600',
  },
  photoCounter: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.sm,
    marginTop: 2,
  },
  placeholder: {
    width: 40,
  },

  // Bottom bar
  bottomBar: {
    paddingHorizontal: Spacing.lg,
  },
  photoInfo: {
    marginBottom: Spacing.xl,
  },
  photoOwnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  ownerInfo: {
    flex: 1,
  },
  ownerName: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.md,
    fontWeight: '600',
  },
  photoTime: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.sm,
    marginTop: 2,
  },

  // Playback controls
  playbackControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  skipButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipIcon: {
    flexDirection: 'row',
    gap: 2,
  },
  skipTriangle: {
    width: 0,
    height: 0,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  skipTriangleLeft: {
    borderRightWidth: 8,
    borderRightColor: Colors.textPrimary,
  },
  skipTriangleRight: {
    borderLeftWidth: 8,
    borderLeftColor: Colors.textPrimary,
  },
  playPauseButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    width: 0,
    height: 0,
    marginLeft: 4,
    borderLeftWidth: 18,
    borderTopWidth: 12,
    borderBottomWidth: 12,
    borderLeftColor: Colors.textPrimary,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  pauseIcon: {
    flexDirection: 'row',
    gap: 6,
  },
  pauseBar: {
    width: 6,
    height: 20,
    backgroundColor: Colors.textPrimary,
    borderRadius: 2,
  },

  // Progress
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  progressDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  progressDotActive: {
    backgroundColor: Colors.accent,
    width: 20,
    borderRadius: 3,
  },
  progressDotCompleted: {
    backgroundColor: Colors.textSecondary,
  },

  // Pause indicator
  pauseIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -40,
    marginLeft: -60,
    width: 120,
    height: 80,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  pauseIndicatorBlur: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  pauseIndicatorIcon: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.sm,
  },
  pauseIndicatorBar: {
    width: 8,
    height: 28,
    backgroundColor: Colors.textPrimary,
    borderRadius: 3,
  },
  pauseIndicatorText: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
  },

  // Error
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  errorText: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.lg,
  },
  errorLink: {
    color: Colors.accent,
    fontSize: Typography.sizes.md,
  },
});
