import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import React, { useState } from 'react';
import {
    Dimensions,
    Image,
    Pressable,
    StyleSheet,
    Text,
    View,
    Platform,
} from 'react-native';
import Animated, {
    FadeInUp,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    interpolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { Colors, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { AvatarStack } from './Avatar';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - (Spacing.lg * 2);
const CARD_HEIGHT = 240;

interface User {
  id: string;
  name: string;
  avatar?: string;
}

type WorldState = 'active' | 'building' | 'archived';

interface WorldCardProps {
  id: string;
  title: string;
  coverUri: string;
  dateRange: string;
  photoCount: number;
  members: User[];
  state?: WorldState;
  index?: number;
  onPress: (id: string) => void;
  onLongPress?: (id: string) => void;
}

/**
 * WorldCard - Premium World preview card
 *
 * Design Principles:
 * - Full-bleed imagery: Photos are heroes
 * - Clear hierarchy: Date → Title → Meta
 * - Minimal text: Just what's needed
 * - Delightful micro-interactions
 */
export function WorldCard({
  id,
  title,
  coverUri,
  dateRange,
  photoCount,
  members,
  state = 'archived',
  index = 0,
  onPress,
  onLongPress,
}: WorldCardProps) {
  const scale = useSharedValue(1);
  const [imageLoaded, setImageLoaded] = useState(false);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: interpolate(scale.value, [0.96, 1], [0.95, 1]),
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 20, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  const handlePress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress(id);
  };

  const handleLongPress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onLongPress?.(id);
  };

  return (
    <Animated.View entering={FadeInUp.delay(index * 60).duration(450).springify()}>
      <Pressable
        onPress={handlePress}
        onLongPress={onLongPress ? handleLongPress : undefined}
        delayLongPress={300}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <Animated.View style={[styles.container, animatedStyle]}>
          {/* Cover Image - Full Bleed */}
          <Image
            source={{ uri: coverUri }}
            style={styles.coverImage}
            resizeMode="cover"
            onLoad={() => setImageLoaded(true)}
          />

          {/* Cinematic Highlight */}
          <View style={styles.topHighlight} />

          {/* Easing Gradient - Smooth Readability */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.85)']}
            locations={[0.4, 0.7, 1]}
            style={styles.gradient}
          />

          {/* Content Layer (Pinned to Bottom) */}
          <View style={styles.content}>
            <View style={styles.bottomSection}>
              <Text style={styles.title} numberOfLines={2}>
                {title}
              </Text>

              {/* Glass Footer Meta */}
              <View style={styles.glassFooter}>
                 <AvatarStack users={members} size="small" maxDisplay={4} />
                 <View style={styles.divider} />
                 <Text style={styles.photoCount}>{photoCount} Photos</Text>
              </View>

              {/* Status/Badges Row - Moved to bottom */}
              <View style={styles.statusRow}>
                 {state !== 'archived' && (
                  Platform.OS !== 'web' ? (
                    <BlurView intensity={20} tint="dark" style={styles.glassBadge}>
                      <View style={[styles.statusDot, styles.statusDotActive]} />
                      <Text style={styles.badgeText}>LIVE</Text>
                    </BlurView>
                  ) : (
                    <View style={[styles.glassBadge, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
                      <View style={[styles.statusDot, styles.statusDotActive]} />
                      <Text style={styles.badgeText}>LIVE</Text>
                    </View>
                  )
                )}
                {Platform.OS !== 'web' ? (
                  <BlurView intensity={20} tint="dark" style={styles.glassBadge}>
                    <Text style={styles.badgeText}>{dateRange}</Text>
                  </BlurView>
                ) : (
                  <View style={[styles.glassBadge, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
                    <Text style={styles.badgeText}>{dateRange}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    ...Shadows.lg,
  },
  coverImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  gradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  content: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.lg,
    paddingTop: Spacing.xl,
  },

  // Top Badges
  // Removed topBadges style

  glassBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.4)', // Fallback for android/no blur
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.textSecondary,
  },
  statusDotActive: {
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 2,
  },
  badgeText: {
    color: Colors.textPrimary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // Bottom Content
  bottomSection: {
    marginTop: 'auto', // Push to bottom
  },
  glassFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  divider: {
    width: 1,
    height: 12,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: Spacing.md,
  },

  // Status Row
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    // marginBottom removed as it's now last
  },

  // State Badge
  stateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
  },
  stateBadgeActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
  },

  // Removed duplicate stateDot and stateDotActive definitions here

  stateText: {
    color: Colors.textPrimary,
    fontSize: 10,
    fontWeight: '600',
  },

  // Date Badge - Pill style
  dateBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
  },
  dateText: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.xs,
    fontWeight: '600',
    opacity: 0.9,
  },

  // Title
  title: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.xl + 4,
    fontWeight: 'bold',
    marginBottom: Spacing.sm, // Reduced bottom margin since badges are below now
    lineHeight: (Typography.sizes.xl + 4) * 1.15,
    letterSpacing: -0.3,
  },

  // Bottom Row
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: Spacing.sm,
    gap: Spacing.xs,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.textSecondary,
    opacity: 0.5,
  },
  photoCount: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.sm,
    fontWeight: '500',
  },
});

export default WorldCard;
