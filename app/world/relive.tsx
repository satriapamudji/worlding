import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  Image,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
  runOnJS,
  cancelAnimation,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { Avatar } from '@/components';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import type { MediaWithOwner, World } from '@/lib/database.types';
import { getWorldMedia, getMediaUrls } from '@/lib/api/media';
import { getWorld } from '@/lib/api/worlds';

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

  // Data state
  const [world, setWorld] = useState<World | null>(null);
  const [photos, setPhotos] = useState<MediaWithOwner[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animation values
  const photoOpacity = useSharedValue(1);
  const kenBurnsScale = useSharedValue(1);
  const kenBurnsX = useSharedValue(0);
  const kenBurnsY = useSharedValue(0);
  const controlsOpacity = useSharedValue(1);

  // Fetch data on mount
  useEffect(() => {
    async function fetchData() {
      if (!worldId) {
        setError('No world ID provided');
        setLoading(false);
        return;
      }

      // Fetch world info
      const worldResult = await getWorld(worldId);
      if (worldResult.error || !worldResult.data) {
        setError(worldResult.error || 'World not found');
        setLoading(false);
        return;
      }
      setWorld(worldResult.data);

      // Fetch media (images only for relive)
      const mediaResult = await getWorldMedia(worldId);
      if (mediaResult.error) {
        setError(mediaResult.error);
        setLoading(false);
        return;
      }

      // Filter to images only
      const imageMedia = mediaResult.data.filter(m => m.type === 'image');
      
      if (imageMedia.length === 0) {
        setError('No photos to relive');
        setLoading(false);
        return;
      }

      setPhotos(imageMedia);

      // Get signed URLs for all photos (prefer Relive preview when available)
      const storagePaths = imageMedia.map(m => m.preview_path ?? m.storage_path);
      const urlsResult = await getMediaUrls(storagePaths, 24 * 60 * 60);
      
      if (urlsResult.data) {
        setPhotoUrls(urlsResult.data);
      }

      setLoading(false);
    }

    fetchData();
  }, [worldId]);

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
  }, [currentIndex, kenBurnsScale, kenBurnsX, kenBurnsY]);

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
  }, [currentIndex, photos.length, router, photoOpacity]);

  // Auto-advance timer
  useEffect(() => {
    if (!loading && !isPaused && photos.length > 0) {
      startKenBurns();
      timerRef.current = setTimeout(goToNext, PHOTO_DURATION);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [currentIndex, isPaused, photos.length, loading, goToNext, startKenBurns]);

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
  }, [showControls, isPaused, controlsOpacity]);

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

  // Loading state
  if (loading) {
    return (
      <View style={[styles.container, styles.errorContainer]}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  // Error or empty state
  if (error || !world || photos.length === 0) {
    return (
      <View style={[styles.container, styles.errorContainer]}>
        <Text style={styles.errorText}>{error || 'No photos to relive'}</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.errorLink}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const currentPhoto = photos[currentIndex];
  const activePhotoPath = currentPhoto.preview_path ?? currentPhoto.storage_path;
  const currentPhotoUrl = photoUrls[activePhotoPath];
  const photoDate = new Date(currentPhoto.taken_at ?? currentPhoto.created_at);
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
          {currentPhotoUrl ? (
            <Image
              source={{ uri: currentPhotoUrl }}
              style={styles.photo}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.photoPlaceholder}>
              <ActivityIndicator size="large" color={Colors.accent} />
            </View>
          )}
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
              <Ionicons name="close" size={20} color={Colors.textPrimary} />
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
                uri={currentPhoto.owner.avatar_url ?? undefined}
                name={currentPhoto.owner.name}
                size="medium"
              />
              <View style={styles.ownerInfoContainer}>
                <Text style={styles.ownerName}>{currentPhoto.owner.name}</Text>
                <Text style={styles.photoTime}>{dateLabel} at {timeLabel}</Text>
              </View>
            </View>
          </View>

          {/* Playback controls */}
          <View style={styles.playbackControls}>
            <Pressable style={styles.skipButton} onPress={handlePrevious}>
              <Ionicons name="play-skip-back" size={20} color={Colors.textPrimary} />
            </Pressable>

            <Pressable style={styles.playPauseButton} onPress={handleTap}>
              <Ionicons 
                name={isPaused ? "play" : "pause"} 
                size={28} 
                color={Colors.textPrimary} 
                style={isPaused ? { marginLeft: 4 } : undefined}
              />
            </Pressable>

            <Pressable style={styles.skipButton} onPress={handleSkip}>
              <Ionicons name="play-skip-forward" size={20} color={Colors.textPrimary} />
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
            <Ionicons name="pause" size={32} color={Colors.textPrimary} />
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
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
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
  ownerInfoContainer: {
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
  playPauseButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
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
    gap: Spacing.sm,
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
