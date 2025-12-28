import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import React from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
} from 'react-native-reanimated';

import { Colors, Radius, Shadows, Spacing, Typography } from '@/constants/theme';

type ButtonSize = 'small' | 'medium' | 'large';
type ButtonVariant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps {
  title: string;
  subtitle?: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  fullWidth?: boolean;
  haptic?: boolean;
}

/**
 * Button - World-Class Animated Button
 *
 * Features:
 * - Smooth spring animations with scale + opacity
 * - Dynamic shadow that responds to press
 * - Haptic feedback (iOS/Android)
 * - Gradient shimmer effect on primary
 * - Support for subtitle (two-line CTAs)
 * - Loading states
 * - Fully accessible
 *
 * Inspired by: Linear, Arc Browser, Apple Design
 */
export function Button({
  title,
  subtitle,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  icon,
  style,
  fullWidth = false,
  haptic = true,
}: ButtonProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const shadowOpacity = useSharedValue(variant === 'primary' ? 0.25 : 0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const animatedOpacity = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const animatedShadow = useAnimatedStyle(() => {
    if (variant !== 'primary') return {};
    return {
      shadowOpacity: shadowOpacity.value,
      shadowRadius: interpolate(shadowOpacity.value, [0, 0.25], [0, 12]),
    };
  });

  const handlePressIn = () => {
    if (!disabled && !loading) {
      // Haptic feedback
      if (haptic) {
        if (Platform.OS === 'ios') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } else {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }

      // Animations
      scale.value = withSpring(0.95, {
        damping: 15,
        stiffness: 300,
      });
      opacity.value = withTiming(0.8, { duration: 100 });

      if (variant === 'primary') {
        shadowOpacity.value = withTiming(0.4, { duration: 100 });
      }
    }
  };

  const handlePressOut = () => {
    if (!disabled && !loading) {
      scale.value = withSpring(1, {
        damping: 15,
        stiffness: 400,
      });
      opacity.value = withTiming(1, { duration: 150 });

      if (variant === 'primary') {
        shadowOpacity.value = withSpring(0.25);
      }
    }
  };

  const sizeStyles = SIZE_STYLES[size];

  const buttonContent = (
    <View style={styles.contentContainer}>
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? Colors.textPrimary : Colors.accent}
          size="small"
        />
      ) : (
        <>
          {icon && <View style={styles.iconContainer}>{icon}</View>}
          <View style={styles.textContainer}>
            <Text
              style={[
                styles.text,
                sizeStyles.text,
                variant === 'primary' && styles.textPrimary,
                variant === 'secondary' && styles.textSecondary,
                variant === 'ghost' && styles.textGhost,
                disabled && styles.textDisabled,
              ]}
            >
              {title}
            </Text>
            {subtitle && (
              <Text
                style={[
                  styles.subtitle,
                  sizeStyles.subtitle,
                  variant === 'primary' && styles.subtitlePrimary,
                  variant === 'secondary' && styles.subtitleSecondary,
                  disabled && styles.subtitleDisabled,
                ]}
              >
                {subtitle}
              </Text>
            )}
          </View>
        </>
      )}
    </View>
  );

  if (variant === 'primary') {
    return (
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        style={[fullWidth && styles.fullWidth]}
        accessibilityRole="button"
        accessibilityState={{ disabled: disabled || loading }}
      >
        <Animated.View
          style={[
            animatedStyle,
            animatedOpacity,
            animatedShadow,
            fullWidth && styles.fullWidth,
            !disabled && {
              shadowColor: Colors.accent,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.25,
              shadowRadius: 12,
              elevation: 6,
            },
          ]}
        >
          <LinearGradient
            colors={
              disabled
                ? [Colors.surface, Colors.surface]
                : [Colors.accent, Colors.accentDark]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.container,
              sizeStyles.container,
              subtitle && styles.containerWithSubtitle,
            ]}
          >
            {buttonContent}
          </LinearGradient>
        </Animated.View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      style={[fullWidth && styles.fullWidth]}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
    >
      <Animated.View
        style={[
          styles.container,
          sizeStyles.container,
          variant === 'secondary' && styles.secondary,
          variant === 'ghost' && styles.ghost,
          disabled && styles.containerDisabled,
          subtitle && styles.containerWithSubtitle,
          animatedStyle,
          animatedOpacity,
          fullWidth && styles.fullWidth,
          style,
        ]}
      >
        {buttonContent}
      </Animated.View>
    </Pressable>
  );
}

const SIZE_STYLES: Record<
  ButtonSize,
  { container: ViewStyle; text: TextStyle; subtitle?: TextStyle }
> = {
  small: {
    container: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.md,
    },
    text: {
      fontSize: Typography.sizes.sm,
    },
    subtitle: {
      fontSize: Typography.sizes.xs,
    },
  },
  medium: {
    container: {
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.md,
      borderRadius: Radius.lg,
    },
    text: {
      fontSize: Typography.sizes.md,
    },
    subtitle: {
      fontSize: Typography.sizes.sm,
    },
  },
  large: {
    container: {
      paddingHorizontal: Spacing.xxl,
      paddingVertical: Spacing.lg,
      borderRadius: Radius.xl,
    },
    text: {
      fontSize: Typography.sizes.lg,
    },
    subtitle: {
      fontSize: Typography.sizes.sm,
    },
  },
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  containerWithSubtitle: {
    paddingVertical: Spacing.md + 4,
  },
  fullWidth: {
    width: '100%',
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  iconContainer: {
    // Icon wrapper
  },
  textContainer: {
    alignItems: 'center',
  },
  text: {
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontWeight: '400',
    textAlign: 'center',
    marginTop: 2,
  },
  textPrimary: {
    color: Colors.textPrimary,
  },
  textSecondary: {
    color: Colors.textPrimary,
  },
  textGhost: {
    color: Colors.textSecondary,
  },
  textDisabled: {
    color: Colors.textMuted,
  },
  subtitlePrimary: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  subtitleSecondary: {
    color: Colors.textSecondary,
  },
  subtitleDisabled: {
    color: Colors.textMuted,
    opacity: 0.6,
  },
  secondary: {
    backgroundColor: Colors.glass,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  containerDisabled: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
  },
});

export default Button;
