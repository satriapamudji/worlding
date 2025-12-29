import { LinearGradient } from 'expo-linear-gradient';
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

          {/* Subtle top highlight for depth */}
          <View style={styles.topHighlight} />

          {/* Gradient Overlay - More dramatic */}
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.9)']}
            locations={[0, 0.35, 1]}
            style={styles.gradient}
          />

          {/* Content */}
          <View style={styles.content}>
            {/* Status Row */}
            <View style={styles.statusRow}>
              {/* State Badge */}
              {state !== 'archived' && (
                <View style={[
                  styles.stateBadge,
                  state === 'building' ? styles.stateBadgeBuilding : styles.stateBadgeActive
                ]}>
                  <View style={[
                    styles.stateDot,
                    state === 'building' ? styles.stateDotBuilding : styles.stateDotActive
                  ]} />
                  <Text style={styles.stateText}>
                    {state === 'building' ? 'Collecting' : 'Live'}
                  </Text>
                </View>
              )}
              {/* Date Badge */}
              <View style={styles.dateBadge}>
                <Text style={styles.dateText}>{dateRange}</Text>
              </View>
            </View>

            {/* Title */}
            <Text style={styles.title} numberOfLines={2}>
              {title}
            </Text>

            {/* Bottom Row: Avatars · Photo Count */}
            <View style={styles.bottomRow}>
              <AvatarStack users={members} size="small" maxDisplay={4} />
              <View style={styles.metaContainer}>
                <View style={styles.dot} />
                <Text style={styles.photoCount}>{photoCount}</Text>
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

  // Status Row
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
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
  stateBadgeBuilding: {
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
  },
  stateDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  stateDotActive: {
    backgroundColor: '#10B981',
  },
  stateDotBuilding: {
    backgroundColor: '#6366F1',
  },
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
    marginBottom: Spacing.md,
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
