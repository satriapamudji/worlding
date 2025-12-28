import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { Image, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';

import { Colors, Layout, Shadows, Typography } from '@/constants/theme';

interface AvatarProps {
  uri?: string;
  name?: string;
  size?: 'small' | 'medium' | 'large';
  style?: StyleProp<ViewStyle>;
  showBorder?: boolean;
}

const SIZES = {
  small: Layout.avatarSizeSmall,
  medium: Layout.avatarSizeMedium,
  large: Layout.avatarSizeLarge,
};

// Generate consistent colors from name
const getAvatarColor = (name: string): string[] => {
  const colors = [
    ['#FF573D', '#E64A32'],
    ['#8B5CF6', '#7C3AED'],
    ['#06B6D4', '#0891B2'],
    ['#10B981', '#059669'],
    ['#F59E0B', '#D97706'],
    ['#EC4899', '#DB2777'],
  ];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
};

/**
 * Avatar - User profile image component
 * 
 * Features:
 * - Multiple sizes (small: 28px, medium: 44px, large: 72px)
 * - Gradient fallback to initials if no image
 * - Optional border for overlapping stacks
 */
export function Avatar({ 
  uri, 
  name = 'User', 
  size = 'medium',
  style,
  showBorder = false,
}: AvatarProps) {
  const dimension = SIZES[size];
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const gradientColors = getAvatarColor(name);

  const containerStyle: StyleProp<ViewStyle> = [
    styles.container,
    {
      width: dimension,
      height: dimension,
      borderRadius: dimension / 2,
    },
    showBorder && styles.border,
    style,
  ];

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={containerStyle as any}
        resizeMode="cover"
      />
    );
  }

  // Fallback: Show gradient with initials
  const fontSize = dimension * 0.38;
  return (
    <LinearGradient
      colors={gradientColors as [string, string]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[containerStyle, styles.gradient]}
    >
      <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
    </LinearGradient>
  );
}

interface AvatarStackProps {
  users: Array<{ id: string; name: string; avatar?: string }>;
  maxDisplay?: number;
  size?: 'small' | 'medium' | 'large';
  style?: StyleProp<ViewStyle>;
  showInvite?: boolean;
  onInvitePress?: () => void;
}

/**
 * AvatarStack - Overlapping avatar group
 */
export function AvatarStack({ 
  users, 
  maxDisplay = 5,
  size = 'medium',
  style,
  showInvite = false,
  onInvitePress,
}: AvatarStackProps) {
  const displayUsers = users.slice(0, maxDisplay);
  const remainingCount = users.length - maxDisplay;
  const dimension = SIZES[size];
  const overlap = dimension * 0.35;

  // Pulsing animation for invite button
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    if (showInvite) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 1000 }),
          withTiming(1, { duration: 1000 })
        ),
        -1,
        true
      );
    }
  }, [showInvite, pulseScale]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  return (
    <View style={[styles.stackContainer, style]}>
      {displayUsers.map((user, index) => (
        <View
          key={user.id}
          style={[
            styles.stackItem,
            { marginLeft: index === 0 ? 0 : -overlap, zIndex: displayUsers.length - index },
          ]}
        >
          <Avatar
            uri={user.avatar}
            name={user.name}
            size={size}
            showBorder
          />
        </View>
      ))}
      
      {remainingCount > 0 && (
        <View
          style={[
            styles.moreIndicator,
            { 
              width: dimension, 
              height: dimension, 
              borderRadius: dimension / 2,
              marginLeft: -overlap,
            },
          ]}
        >
          <Text style={styles.moreText}>+{remainingCount}</Text>
        </View>
      )}

      {showInvite && (
        <Animated.View style={[pulseStyle]}>
          <LinearGradient
            colors={[Colors.accent, Colors.accentDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.inviteButton,
              { 
                width: dimension, 
                height: dimension, 
                borderRadius: dimension / 2,
                marginLeft: users.length > 0 ? -overlap : 0,
              },
            ]}
          >
            <Text style={styles.inviteText}>+</Text>
          </LinearGradient>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  border: {
    borderWidth: 2,
    borderColor: Colors.background,
  },
  gradient: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  stackContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stackItem: {
    ...Shadows.sm,
  },
  moreIndicator: {
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreText: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.xs,
    fontWeight: '600',
  },
  inviteButton: {
    borderWidth: 2,
    borderColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.glowSubtle,
  },
  inviteText: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.lg,
    fontWeight: '300',
  },
});

export default Avatar;
