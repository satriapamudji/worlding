import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

import { Colors, Spacing } from '@/constants/theme';

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

/**
 * StepIndicator - Simple progress dots for multi-step flows
 *
 * Features:
 * - Minimal dot indicators (● ○)
 * - Animated transitions between steps
 * - Subtle, non-intrusive design
 */
export function StepIndicator({ currentStep, totalSteps }: StepIndicatorProps) {
  return (
    <View style={styles.container}>
      {Array.from({ length: totalSteps }, (_, index) => (
        <StepDot
          key={index}
          isActive={index + 1 === currentStep}
          isCompleted={index + 1 < currentStep}
        />
      ))}
    </View>
  );
}

interface StepDotProps {
  isActive: boolean;
  isCompleted: boolean;
}

function StepDot({ isActive, isCompleted }: StepDotProps) {
  const animatedStyle = useAnimatedStyle(() => {
    const scale = isActive ? 1.2 : 1;
    const opacity = isActive || isCompleted ? 1 : 0.4;

    return {
      transform: [{ scale: withSpring(scale, { damping: 15, stiffness: 300 }) }],
      opacity: withSpring(opacity, { damping: 20, stiffness: 200 }),
      backgroundColor: isActive || isCompleted ? Colors.accent : Colors.textMuted,
    };
  });

  return <Animated.View style={[styles.dot, animatedStyle]} />;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.textMuted,
  },
});

export default StepIndicator;
