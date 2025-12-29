import React, { useRef, useCallback, useEffect, useState } from 'react';
import {
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputKeyPressEventData,
  View,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  runOnJS,
  interpolateColor,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';

const OTP_LENGTH = 6;

type FlashState = 'none' | 'success' | 'error';

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: boolean;
  success?: boolean;
  onFlashComplete?: () => void;
}

/**
 * OtpInput - 6-box OTP code input with enhanced UX
 *
 * Features:
 * - 6 separate input boxes for each digit
 * - Auto-advance to next box on input
 * - Auto-backspace to previous box
 * - Paste support for full 6-digit code
 * - Glow border on focused box
 * - Green flash on success, red flash on error
 * - Haptic feedback on digit entry
 */
export function OtpInput({
  value,
  onChange,
  disabled = false,
  error = false,
  success = false,
  onFlashComplete,
}: OtpInputProps) {
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [flashState, setFlashState] = useState<FlashState>('none');

  // Animation values for flash effect
  const flashProgress = useSharedValue(0);

  const digits = value.split('').concat(Array(OTP_LENGTH).fill('')).slice(0, OTP_LENGTH);

  // Handle error/success flash
  useEffect(() => {
    if (error) {
      setFlashState('error');
      triggerFlash();
    } else if (success) {
      setFlashState('success');
      triggerFlash();
    }
  }, [error, success]);

  const triggerFlash = useCallback(() => {
    // Haptic feedback
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(
        flashState === 'success' 
          ? Haptics.NotificationFeedbackType.Success 
          : Haptics.NotificationFeedbackType.Error
      );
    }

    // Animate flash: 0 -> 1 -> 0
    flashProgress.value = withSequence(
      withTiming(1, { duration: 150 }),
      withTiming(0, { duration: 300 }, () => {
        if (onFlashComplete) {
          runOnJS(onFlashComplete)();
        }
        runOnJS(setFlashState)('none');
      })
    );
  }, [flashState, flashProgress, onFlashComplete]);

  const focusInput = useCallback((index: number) => {
    if (index >= 0 && index < OTP_LENGTH) {
      inputRefs.current[index]?.focus();
    }
  }, []);

  const triggerHaptic = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  const handleChange = useCallback(
    (text: string, index: number) => {
      // Handle paste (multiple characters)
      if (text.length > 1) {
        const pastedCode = text.replace(/[^0-9]/g, '').slice(0, OTP_LENGTH);
        onChange(pastedCode);
        triggerHaptic();
        if (pastedCode.length === OTP_LENGTH) {
          inputRefs.current[OTP_LENGTH - 1]?.blur();
          // Medium haptic for completion
          if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
        } else {
          focusInput(pastedCode.length);
        }
        return;
      }

      // Handle single digit input
      const digit = text.replace(/[^0-9]/g, '');
      if (digit) {
        triggerHaptic();
      }
      
      const newValue = value.split('');
      newValue[index] = digit;
      const newOtp = newValue.join('').slice(0, OTP_LENGTH);
      onChange(newOtp);

      // Auto-advance to next input
      if (digit && index < OTP_LENGTH - 1) {
        focusInput(index + 1);
      } else if (digit && index === OTP_LENGTH - 1) {
        // Last digit entered - blur and give medium haptic
        inputRefs.current[index]?.blur();
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
      }
    },
    [value, onChange, focusInput, triggerHaptic]
  );

  const handleKeyPress = useCallback(
    (e: NativeSyntheticEvent<TextInputKeyPressEventData>, index: number) => {
      if (e.nativeEvent.key === 'Backspace') {
        if (!digits[index] && index > 0) {
          // Current box is empty, go to previous box and clear it
          const newValue = value.split('');
          newValue[index - 1] = '';
          onChange(newValue.join(''));
          focusInput(index - 1);
          triggerHaptic();
        } else if (digits[index]) {
          // Current box has value, clear it
          const newValue = value.split('');
          newValue[index] = '';
          onChange(newValue.join(''));
          triggerHaptic();
        }
      }
    },
    [digits, value, onChange, focusInput, triggerHaptic]
  );

  const handleBoxPress = useCallback(
    (index: number) => {
      if (disabled) return;
      // Focus the first empty box or the tapped box
      const firstEmptyIndex = digits.findIndex((d) => !d);
      const targetIndex = firstEmptyIndex === -1 ? OTP_LENGTH - 1 : Math.min(index, firstEmptyIndex);
      focusInput(targetIndex);
    },
    [disabled, digits, focusInput]
  );

  const handleFocus = useCallback((index: number) => {
    setFocusedIndex(index);
  }, []);

  const handleBlur = useCallback(() => {
    setFocusedIndex(null);
  }, []);

  return (
    <View style={styles.container}>
      {digits.map((digit, index) => (
        <OtpBox
          key={index}
          index={index}
          digit={digit}
          isFocused={focusedIndex === index}
          flashState={flashState}
          flashProgress={flashProgress}
          disabled={disabled}
          inputRef={(ref) => {
            inputRefs.current[index] = ref;
          }}
          onPress={() => handleBoxPress(index)}
          onChangeText={(text) => handleChange(text, index)}
          onKeyPress={(e) => handleKeyPress(e, index)}
          onFocus={() => handleFocus(index)}
          onBlur={handleBlur}
        />
      ))}
    </View>
  );
}

interface OtpBoxProps {
  index: number;
  digit: string;
  isFocused: boolean;
  flashState: FlashState;
  flashProgress: SharedValue<number>;
  disabled: boolean;
  inputRef: (ref: TextInput | null) => void;
  onPress: () => void;
  onChangeText: (text: string) => void;
  onKeyPress: (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => void;
  onFocus: () => void;
  onBlur: () => void;
}

function OtpBox({
  digit,
  isFocused,
  flashState,
  flashProgress,
  disabled,
  inputRef,
  onPress,
  onChangeText,
  onKeyPress,
  onFocus,
  onBlur,
}: OtpBoxProps) {
  const animatedStyle = useAnimatedStyle(() => {
    let borderColor = Colors.border;
    let backgroundColor = Colors.surface;

    if (flashState === 'success') {
      borderColor = interpolateColor(
        flashProgress.value,
        [0, 1],
        [Colors.border, Colors.success]
      ) as string;
      backgroundColor = interpolateColor(
        flashProgress.value,
        [0, 1],
        [Colors.surface, 'rgba(16, 185, 129, 0.15)']
      ) as string;
    } else if (flashState === 'error') {
      borderColor = interpolateColor(
        flashProgress.value,
        [0, 1],
        [Colors.border, Colors.error]
      ) as string;
      backgroundColor = interpolateColor(
        flashProgress.value,
        [0, 1],
        [Colors.surface, 'rgba(239, 68, 68, 0.15)']
      ) as string;
    }

    return {
      borderColor,
      backgroundColor,
    };
  });

  return (
    <Pressable onPress={onPress} style={styles.boxPressable}>
      <Animated.View
        style={[
          styles.box,
          isFocused && styles.boxFocused,
          animatedStyle,
        ]}
      >
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={digit}
          onChangeText={onChangeText}
          onKeyPress={onKeyPress}
          onFocus={onFocus}
          onBlur={onBlur}
          keyboardType="number-pad"
          maxLength={OTP_LENGTH}
          selectTextOnFocus
          editable={!disabled}
          caretHidden
        />
        {digit ? (
          <Text style={styles.digit}>{digit}</Text>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  boxPressable: {
    flex: 1,
    maxWidth: 48,
  },
  box: {
    height: 56,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  boxFocused: {
    borderColor: Colors.accent,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  input: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0,
    fontSize: Typography.sizes.xl,
    textAlign: 'center',
    color: Colors.textPrimary,
  },
  digit: {
    fontSize: 24,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
});

export default OtpInput;
