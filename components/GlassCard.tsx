import { BlurView } from 'expo-blur';
import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Colors, Radius, Shadows, Spacing } from '@/constants/theme';

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  animated?: boolean;
  variant?: 'default' | 'elevated' | 'subtle';
}

/**
 * GlassCard - Premium glassmorphic container
 * 
 * Features:
 * - Semi-transparent background with blur
 * - Subtle highlight border for depth
 * - Three variants: default, elevated, subtle
 * - Optional entrance animation
 */
export function GlassCard({ 
  children, 
  style, 
  intensity = 25,
  animated = true,
  variant = 'default',
}: GlassCardProps) {
  const Container = animated ? Animated.View : View;
  const animatedProps = animated ? { entering: FadeIn.duration(400) } : {};

  const variantStyles = {
    default: {
      background: Colors.glass,
      border: Colors.glassBorder,
    },
    elevated: {
      background: Colors.glassLight,
      border: Colors.glassBorder,
    },
    subtle: {
      background: Colors.glassHighlight,
      border: 'transparent',
    },
  };

  const currentVariant = variantStyles[variant];

  return (
    <Container 
      style={[
        styles.container, 
        variant === 'elevated' && Shadows.md,
        style,
      ]}
      {...animatedProps}
    >
      <BlurView intensity={intensity} style={styles.blur} tint="dark">
        <View style={[
          styles.content,
          { 
            backgroundColor: currentVariant.background,
            borderColor: currentVariant.border,
          },
        ]}>
          {/* Top highlight for glass effect */}
          <View style={styles.highlight} />
          {children}
        </View>
      </BlurView>
    </Container>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: Radius.xl,
    overflow: 'hidden',
  },
  blur: {
    // Removed flex: 1 - let content determine size naturally
  },
  content: {
    // Removed flex: 1 - prevents collapse when parent has no explicit height
    padding: Spacing.lg,
    borderWidth: 1,
    borderRadius: Radius.xl,
    position: 'relative',
  },
  highlight: {
    position: 'absolute',
    top: 0,
    left: Spacing.lg,
    right: Spacing.lg,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
});

export default GlassCard;
