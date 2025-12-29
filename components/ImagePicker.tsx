/**
 * ImagePicker - Reusable image picker component
 *
 * Features:
 * - Pick from camera or gallery
 * - Customizable aspect ratio
 * - Returns selected image URI
 */

import { Ionicons } from '@expo/vector-icons';
import * as ExpoImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';

interface ImagePickerProps {
  /** Current image URI (if any) */
  value?: string | null;
  /** Callback when image is selected */
  onChange: (uri: string) => void;
  /** Placeholder text when no image */
  placeholder?: string;
  /** Placeholder icon */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Aspect ratio for cropping [width, height] */
  aspect?: [number, number];
  /** Size preset */
  size?: 'small' | 'medium' | 'large';
  /** Shape */
  shape?: 'square' | 'circle';
  /** Allow editing/cropping */
  allowsEditing?: boolean;
  /** Image quality (0-1) */
  quality?: number;
  /** Show camera option */
  showCamera?: boolean;
  /** Disabled state */
  disabled?: boolean;
}

const SIZES = {
  small: 80,
  medium: 120,
  large: 200,
};

export function ImagePicker({
  value,
  onChange,
  placeholder = 'Add photo',
  icon = 'camera-outline',
  aspect = [1, 1],
  size = 'medium',
  shape = 'square',
  allowsEditing = true,
  quality = 0.8,
  showCamera = true,
  disabled = false,
}: ImagePickerProps) {
  const [isLoading, setIsLoading] = useState(false);
  
  const dimension = SIZES[size];
  const borderRadius = shape === 'circle' ? dimension / 2 : Radius.lg;
  
  const triggerHaptic = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);
  
  const pickImage = useCallback(async (source: 'camera' | 'gallery') => {
    if (disabled) return;
    
    triggerHaptic();
    setIsLoading(true);
    
    try {
      // Request permissions
      if (source === 'camera') {
        const { status } = await ExpoImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          setIsLoading(false);
          return;
        }
      } else {
        const { status } = await ExpoImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          setIsLoading(false);
          return;
        }
      }
      
      // Launch picker
      const options: ExpoImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        allowsEditing,
        aspect,
        quality,
      };
      
      const result = source === 'camera'
        ? await ExpoImagePicker.launchCameraAsync(options)
        : await ExpoImagePicker.launchImageLibraryAsync(options);
      
      if (!result.canceled && result.assets[0]) {
        onChange(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Image picker error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [allowsEditing, aspect, disabled, onChange, quality, triggerHaptic]);
  
  const handlePress = useCallback(() => {
    // For simplicity, go straight to gallery
    // Could show an action sheet for camera vs gallery choice
    pickImage('gallery');
  }, [pickImage]);
  
  const handleLongPress = useCallback(() => {
    if (showCamera) {
      pickImage('camera');
    }
  }, [pickImage, showCamera]);
  
  return (
    <Pressable
      onPress={handlePress}
      onLongPress={handleLongPress}
      disabled={disabled || isLoading}
      style={({ pressed }) => [
        styles.container,
        {
          width: dimension,
          height: dimension,
          borderRadius,
          opacity: pressed ? 0.8 : 1,
        },
        disabled && styles.disabled,
      ]}
    >
      {value ? (
        <>
          <Image
            source={{ uri: value }}
            style={[
              styles.image,
              { borderRadius },
            ]}
          />
          <View style={[styles.editOverlay, { borderRadius }]}>
            <Ionicons name="pencil" size={16} color={Colors.textPrimary} />
          </View>
        </>
      ) : (
        <View style={styles.placeholder}>
          {isLoading ? (
            <ActivityIndicator size="small" color={Colors.textSecondary} />
          ) : (
            <>
              <Ionicons
                name={icon}
                size={size === 'small' ? 24 : 32}
                color={Colors.textMuted}
              />
              <Text style={styles.placeholderText}>{placeholder}</Text>
            </>
          )}
        </View>
      )}
      
      {showCamera && !value && (
        <Text style={styles.hint}>Hold for camera</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  editOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 28,
    height: 28,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  placeholderText: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.xs,
    textAlign: 'center',
  },
  hint: {
    position: 'absolute',
    bottom: -20,
    fontSize: 10,
    color: Colors.textMuted,
  },
});
