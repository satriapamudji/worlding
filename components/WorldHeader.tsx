import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
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
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { Colors, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { AvatarStack } from './Avatar';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HEADER_HEIGHT = 320;

interface User {
  id: string;
  name: string;
  avatar?: string;
}

interface WorldHeaderProps {
  title: string;
  coverUri: string;
  dateRange?: string;
  members: User[];
  onInvitePress?: () => void;
  onPlayPress?: () => void;
}

/**
 * WorldHeader - Hero section for World View
 *
 * Features:
 * - Full-width cover image with parallax potential
 * - Linear gradient overlay (transparent → background)
 * - Title and date range with refined typography
 * - AvatarStack with invite button
 * - FAB for "Watch the Movie" with proper icon
 */
export function WorldHeader({
  title,
  coverUri,
  dateRange,
  members,
  onInvitePress,
  onPlayPress,
}: WorldHeaderProps) {
  const playButtonScale = useSharedValue(1);

  const handlePlayPressIn = () => {
    playButtonScale.value = withSpring(0.92, { damping: 15, stiffness: 400 });
  };

  const handlePlayPressOut = () => {
    playButtonScale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  const handlePlayPress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onPlayPress?.();
  };

  const playButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: playButtonScale.value }],
  }));

  // Generate member names for display
  const memberNames = members.slice(0, 2).map(m => m.name.split(' ')[0]).join(', ');
  const extraCount = members.length > 2 ? ` +${members.length - 2}` : '';

  return (
    <View style={styles.container}>
      {/* Cover Image */}
      <Image
        source={{ uri: coverUri }}
        style={styles.coverImage}
        resizeMode="cover"
      />

      {/* Gradient Overlay - More dramatic */}
      <LinearGradient
        colors={['rgba(5,5,5,0)', 'rgba(5,5,5,0.3)', 'rgba(5,5,5,0.8)', Colors.background]}
        locations={[0, 0.4, 0.7, 1]}
        style={styles.gradient}
      />

      {/* Content Container */}
      <Animated.View
        style={styles.content}
        entering={FadeInUp.delay(150).duration(400)}
      >
        {/* Date Range Badge */}
        {dateRange && (
          <View style={styles.dateBadge}>
            <Text style={styles.dateText}>{dateRange}</Text>
          </View>
        )}

        {/* Title */}
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>

        {/* Members Row - More informative */}
        <View style={styles.membersRow}>
          <AvatarStack
            users={members}
            size="medium"
            showInvite={true}
            onInvitePress={onInvitePress}
          />
          <View style={styles.memberInfo}>
            <Text style={styles.memberNames}>
              {memberNames}{extraCount}
            </Text>
          </View>
        </View>
      </Animated.View>

      {/* Play FAB - Refined design */}
      {onPlayPress && (
        <Pressable
          onPress={handlePlayPress}
          onPressIn={handlePlayPressIn}
          onPressOut={handlePlayPressOut}
        >
          <Animated.View style={[styles.playButton, playButtonStyle]}>
            <LinearGradient
              colors={[Colors.accent, Colors.accentDark]}
              style={styles.playButtonGradient}
            >
              {/* CSS Play Icon */}
              <View style={styles.playIconContainer}>
                <View style={styles.playTriangle} />
              </View>
            </LinearGradient>
          </Animated.View>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: HEADER_HEIGHT,
    position: 'relative',
  },
  coverImage: {
    width: SCREEN_WIDTH,
    height: HEADER_HEIGHT,
    position: 'absolute',
    top: 0,
    left: 0,
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
    bottom: Spacing.lg,
    left: Spacing.md,
    right: 80, // Make room for FAB
  },
  dateBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
    marginBottom: Spacing.sm,
  },
  dateText: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.xs,
    fontWeight: '600',
    opacity: 0.9,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.xxl + 4,
    fontWeight: 'bold',
    marginBottom: Spacing.md,
    letterSpacing: -0.5,
    lineHeight: (Typography.sizes.xxl + 4) * 1.1,
  },
  membersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  memberInfo: {
    flex: 1,
  },
  memberNames: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.sm,
    fontWeight: '500',
  },

  // Play FAB
  playButton: {
    position: 'absolute',
    bottom: Spacing.lg,
    right: Spacing.md,
    width: 60,
    height: 60,
    borderRadius: 30,
    ...Shadows.glow,
  },
  playButtonGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIconContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4, // Visual centering for play icon
  },
  playTriangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 14,
    borderTopWidth: 9,
    borderBottomWidth: 9,
    borderLeftColor: Colors.textPrimary,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },
});

export default WorldHeader;
