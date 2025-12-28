/**
 * MediaViewer - Zoomable media display component
 * 
 * Features:
 * - Pinch-to-zoom (1x to 4x)
 * - Double-tap to zoom in/reset
 * - Pan gesture when zoomed
 * - Video playback with tap to pause
 * - Smooth spring animations
 */

import * as Haptics from 'expo-haptics';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Dimensions,
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeOut,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Colors, Spacing, Typography } from '@/constants/theme';
import type { Photo } from '@/constants/mockData';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2;

interface MediaViewerProps {
  media: Photo;
  isActive: boolean;
  onZoomChange?: (isZoomed: boolean) => void;
}

/**
 * MediaViewer - Single media item with gesture support
 */
export function MediaViewer({
  media,
  isActive,
  onZoomChange,
}: MediaViewerProps) {
  // Scale and translation for zoom/pan
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  
  // Video player state
  const [isPlaying, setIsPlaying] = React.useState(false);
  
  // Track zoom state for enabling/disabling pan gesture
  const [isZoomed, setIsZoomed] = useState(false);

  // Clamp translation to bounds (worklet for use in gesture handlers)
  const clampTranslation = (
    x: number,
    y: number,
    currentScale: number
  ) => {
    'worklet';
    // Calculate max translation based on scale
    const scaledWidth = SCREEN_WIDTH * currentScale;
    const scaledHeight = SCREEN_HEIGHT * currentScale;
    const maxX = Math.max(0, (scaledWidth - SCREEN_WIDTH) / 2);
    const maxY = Math.max(0, (scaledHeight - SCREEN_HEIGHT) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  };

  // Reset zoom when becoming inactive
  useEffect(() => {
    if (!isActive) {
      scale.value = withTiming(1, { duration: 200 });
      translateX.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(0, { duration: 200 });
      savedScale.value = 1;
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
      setIsZoomed(false);
    }
  }, [isActive]);

  // Notify parent and update local zoom state
  const updateZoomState = useCallback((zoomed: boolean) => {
    setIsZoomed(zoomed);
    onZoomChange?.(zoomed);
  }, [onZoomChange]);

  // Haptic feedback helper
  const triggerHaptic = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  // Pinch gesture for zoom
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
    })
    .onUpdate((event) => {
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, savedScale.value * event.scale));
      scale.value = newScale;
      
      // Adjust translation to stay in bounds during scale
      const clamped = clampTranslation(translateX.value, translateY.value, newScale);
      translateX.value = clamped.x;
      translateY.value = clamped.y;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
      
      const isZoomed = scale.value > 1.1;
      runOnJS(updateZoomState)(isZoomed);
      
      // Snap back smoothly if scale is too small (use timing, not spring, to avoid bounce)
      if (scale.value < MIN_SCALE) {
        scale.value = withTiming(MIN_SCALE, { duration: 200 });
        translateX.value = withTiming(0, { duration: 200 });
        translateY.value = withTiming(0, { duration: 200 });
      }
    });

  // Pan gesture for moving when zoomed (only enabled when zoomed to allow FlatList swiping)
  const panGesture = Gesture.Pan()
    .enabled(isZoomed)
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((event) => {
      const clamped = clampTranslation(
        savedTranslateX.value + event.translationX,
        savedTranslateY.value + event.translationY,
        scale.value
      );
      translateX.value = clamped.x;
      translateY.value = clamped.y;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  // Double tap to zoom in/out
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((event) => {
      runOnJS(triggerHaptic)();
      
      if (scale.value > 1.1) {
        // Zoom out - use timing for smooth animation without bounce
        scale.value = withTiming(1, { duration: 250 });
        translateX.value = withTiming(0, { duration: 250 });
        translateY.value = withTiming(0, { duration: 250 });
        savedScale.value = 1;
        runOnJS(updateZoomState)(false);
      } else {
        // Zoom in to double tap point - use spring for lively feel
        const targetScale = DOUBLE_TAP_SCALE;
        
        // Calculate focal point offset from center
        const focalX = event.x - SCREEN_WIDTH / 2;
        const focalY = event.y - SCREEN_HEIGHT / 2;
        
        // Calculate translation to center on focal point
        const newTranslateX = -focalX * (targetScale - 1);
        const newTranslateY = -focalY * (targetScale - 1);
        
        const clamped = clampTranslation(newTranslateX, newTranslateY, targetScale);
        
        scale.value = withSpring(targetScale, { damping: 15, stiffness: 300 });
        translateX.value = withSpring(clamped.x, { damping: 15, stiffness: 300 });
        translateY.value = withSpring(clamped.y, { damping: 15, stiffness: 300 });
        savedScale.value = targetScale;
        savedTranslateX.value = clamped.x;
        savedTranslateY.value = clamped.y;
        runOnJS(updateZoomState)(true);
      }
    });

  // Single tap - no action for images (UI is always visible)
  // We still need this to prevent double-tap from being delayed
  const singleTapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => {
      // No action - UI is always visible
    });

  // Combine gestures
  const composedGesture = Gesture.Simultaneous(
    Gesture.Exclusive(doubleTapGesture, singleTapGesture),
    Gesture.Simultaneous(pinchGesture, panGesture)
  );

  // Animated style for the media container
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  // Simple tap gesture for videos - only play/pause
  const videoTapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => {
      runOnJS(setIsPlaying)(!isPlaying);
      runOnJS(triggerHaptic)();
    });

  // Render video (no zoom/pan - only tap for play/pause)
  if (media.type === 'video') {
    return (
      <GestureDetector gesture={videoTapGesture}>
        <View style={styles.container}>
          <VideoPlayer
            uri={media.uri}
            isActive={isActive}
            isPlaying={isPlaying}
            onPlayingChange={setIsPlaying}
          />
        </View>
      </GestureDetector>
    );
  }

  // Render image
  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View style={[styles.container, animatedStyle]}>
        <Image
          source={{ uri: media.uri }}
          style={styles.image}
          resizeMode="contain"
        />
      </Animated.View>
    </GestureDetector>
  );
}

/**
 * VideoPlayer - Video component with auto-play and timeline support
 */
interface VideoPlayerProps {
  uri: string;
  isActive: boolean;
  isPlaying: boolean;
  onPlayingChange: (playing: boolean) => void;
}

function VideoPlayer({ uri, isActive, isPlaying, onPlayingChange }: VideoPlayerProps) {
  const player = useVideoPlayer(uri, (player) => {
    player.loop = true;
    player.timeUpdateEventInterval = 0.25; // Update every 250ms
  });

  // Time tracking state
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const wasPlayingBeforeSeek = React.useRef(false);

  // Handle play/pause based on active state and user interaction
  useEffect(() => {
    if (isActive && isPlaying && !isSeeking) {
      player.play();
    } else {
      player.pause();
    }
  }, [isActive, isPlaying, isSeeking, player]);

  // Auto-play when becoming active
  useEffect(() => {
    if (isActive) {
      onPlayingChange(true);
    } else {
      onPlayingChange(false);
    }
  }, [isActive, onPlayingChange]);

  // Listen for time updates
  useEffect(() => {
    const subscription = player.addListener('timeUpdate', (event) => {
      if (!isSeeking) {
        setCurrentTime(event.currentTime);
      }
      // Duration might update as video loads
      if (player.duration && player.duration !== duration) {
        setDuration(player.duration);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [player, duration, isSeeking]);

  // Handle seek start
  const handleSeekStart = useCallback(() => {
    wasPlayingBeforeSeek.current = isPlaying;
    setIsSeeking(true);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [isPlaying]);

  // Handle seek
  const handleSeek = useCallback((time: number) => {
    setCurrentTime(time);
    player.currentTime = time;
  }, [player]);

  // Handle seek end
  const handleSeekEnd = useCallback(() => {
    setIsSeeking(false);
    if (wasPlayingBeforeSeek.current) {
      onPlayingChange(true);
    }
  }, [onPlayingChange]);

  return (
    <View style={styles.videoContainer}>
      <VideoView
        player={player}
        style={styles.video}
        contentFit="contain"
        nativeControls={false}
      />
      {/* Play/Pause indicator */}
      {!isPlaying && !isSeeking && (
        <View style={styles.playOverlay}>
          <View style={styles.playButton}>
            <View style={styles.playIcon} />
          </View>
        </View>
      )}
      {/* Video Timeline - Always visible when duration is known */}
      {duration > 0 && (
        <VideoTimeline
          currentTime={currentTime}
          duration={duration}
          onSeekStart={handleSeekStart}
          onSeek={handleSeek}
          onSeekEnd={handleSeekEnd}
        />
      )}
    </View>
  );
}

/**
 * VideoTimeline - YouTube-style thin progress bar with scrubbing
 */
interface VideoTimelineProps {
  currentTime: number;
  duration: number;
  onSeekStart: () => void;
  onSeek: (time: number) => void;
  onSeekEnd: () => void;
}

function VideoTimeline({
  currentTime,
  duration,
  onSeekStart,
  onSeek,
  onSeekEnd,
}: VideoTimelineProps) {
  const progress = duration > 0 ? currentTime / duration : 0;
  
  // Use shared values for properties accessed in worklets/animated styles
  const trackWidth = useSharedValue(SCREEN_WIDTH - Spacing.lg * 2);
  const isScrubbing = useSharedValue(false);
  const scrubProgress = useSharedValue(progress);
  
  // Keep shared value in sync when not scrubbing
  useEffect(() => {
    if (!isScrubbing.value) {
      scrubProgress.value = progress;
    }
  }, [progress, isScrubbing, scrubProgress]);

  // Format time as M:SS or MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Helper to calculate and apply seek
  const applySeek = useCallback((eventX: number) => {
    const width = trackWidth.value;
    const touchX = Math.max(0, Math.min(width, eventX));
    const newProgress = touchX / width;
    scrubProgress.value = newProgress;
    onSeek(newProgress * duration);
  }, [duration, onSeek, scrubProgress, trackWidth]);

  // Pan gesture for scrubbing
  const panGesture = Gesture.Pan()
    .onStart((event) => {
      isScrubbing.value = true;
      runOnJS(onSeekStart)();
      runOnJS(applySeek)(event.x);
    })
    .onUpdate((event) => {
      runOnJS(applySeek)(event.x);
    })
    .onEnd(() => {
      isScrubbing.value = false;
      runOnJS(onSeekEnd)();
    });

  // Tap gesture for quick seek
  const tapGesture = Gesture.Tap()
    .onEnd((event) => {
      runOnJS(onSeekStart)();
      runOnJS(applySeek)(event.x);
      runOnJS(onSeekEnd)();
      if (Platform.OS !== 'web') {
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
      }
    });

  const composedGesture = Gesture.Race(panGesture, tapGesture);

  // Animated style for progress bar
  const progressStyle = useAnimatedStyle(() => ({
    width: `${scrubProgress.value * 100}%`,
  }));

  // Animated style for scrubber thumb
  const thumbStyle = useAnimatedStyle(() => ({
    left: scrubProgress.value * trackWidth.value - 6,
    transform: [{ scale: withTiming(isScrubbing.value ? 1.5 : 1, { duration: 100 }) }],
  }));

  // Handle layout to get track width
  const handleLayout = useCallback((e: { nativeEvent: { layout: { width: number } } }) => {
    trackWidth.value = e.nativeEvent.layout.width;
  }, [trackWidth]);

  return (
    <Animated.View 
      entering={FadeIn.duration(200)} 
      exiting={FadeOut.duration(200)}
      style={styles.timelineContainer}
    >
      {/* Time labels */}
      <View style={styles.timeLabels}>
        <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
        <Text style={styles.timeText}>{formatTime(duration)}</Text>
      </View>
      
      {/* Progress bar with gesture handler */}
      <GestureDetector gesture={composedGesture}>
        <View 
          style={styles.trackContainer}
          onLayout={handleLayout}
        >
          {/* Track background */}
          <View style={styles.track}>
            {/* Progress fill */}
            <Animated.View style={[styles.progressFill, progressStyle]} />
          </View>
          
          {/* Scrubber thumb (visible when scrubbing or hovering) */}
          <Animated.View style={[styles.thumb, thumbStyle]} />
        </View>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  videoContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    width: 0,
    height: 0,
    borderLeftWidth: 24,
    borderTopWidth: 16,
    borderBottomWidth: 16,
    borderLeftColor: Colors.textPrimary,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    marginLeft: 6,
  },
  // Video Timeline styles
  timelineContainer: {
    position: 'absolute',
    bottom: 120, // Above footer area
    left: Spacing.lg,
    right: Spacing.lg,
  },
  timeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  timeText: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.xs,
    fontWeight: '500',
  },
  trackContainer: {
    height: 24, // Larger hit area for easier scrubbing
    justifyContent: 'center',
  },
  track: {
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: 1.5,
  },
  thumb: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.accent,
    top: 6, // Center on track
  },
});

export default MediaViewer;
