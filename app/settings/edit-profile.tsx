import FontAwesome from '@expo/vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CURRENT_USER } from '@/constants/mockData';
import { Colors, Radius, Shadows, Spacing, Typography } from '@/constants/theme';

/**
 * Edit Profile Screen
 *
 * Features:
 * - Avatar with edit overlay (camera icon)
 * - Name input field
 * - Username input field (future)
 * - Save button in header
 * - Back navigation
 */
export default function EditProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState(CURRENT_USER.name);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const handleNameChange = (text: string) => {
    setName(text);
    setHasChanges(text !== CURRENT_USER.name);
  };

  const handleSave = async () => {
    if (!hasChanges || isSaving) return;

    setIsSaving(true);
    try {
      // TODO: Implement profile update via Supabase
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API call
      router.back();
    } catch (error) {
      console.error('Failed to save profile:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarPress = () => {
    // TODO: Implement image picker
    console.log('TODO: Open image picker');
  };

  const firstName = CURRENT_USER.name.split(' ')[0];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <FontAwesome name="chevron-left" size={18} color={Colors.textPrimary} />
        </Pressable>

        <Text style={styles.headerTitle}>Edit Profile</Text>

        <Pressable
          style={[styles.saveButton, !hasChanges && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!hasChanges || isSaving}
        >
          <Text
            style={[styles.saveText, !hasChanges && styles.saveTextDisabled]}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Text>
        </Pressable>
      </Animated.View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Avatar Section */}
        <Animated.View
          entering={FadeInUp.delay(100).duration(400)}
          style={styles.avatarSection}
        >
          <Pressable onPress={handleAvatarPress} style={styles.avatarContainer}>
            {CURRENT_USER.avatar ? (
              <Image source={{ uri: CURRENT_USER.avatar }} style={styles.avatar} />
            ) : (
              <LinearGradient
                colors={[Colors.accent, Colors.accentDark]}
                style={styles.avatar}
              >
                <Text style={styles.avatarText}>{firstName.slice(0, 1)}</Text>
              </LinearGradient>
            )}

            {/* Camera Overlay */}
            <View style={styles.cameraOverlay}>
              <FontAwesome name="camera" size={14} color={Colors.textPrimary} />
            </View>
          </Pressable>

          <Pressable onPress={handleAvatarPress}>
            <Text style={styles.changePhotoText}>Change Photo</Text>
          </Pressable>
        </Animated.View>

        {/* Form Fields */}
        <Animated.View
          entering={FadeInUp.delay(200).duration(400)}
          style={styles.formSection}
        >
          {/* Name Field */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Name</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={handleNameChange}
                placeholder="Your name"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="done"
              />
            </View>
          </View>

          {/* Email Field (Read-only) */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Email</Text>
            <View style={[styles.inputContainer, styles.inputDisabled]}>
              <Text style={styles.inputDisabledText}>
                {/* TODO: Get from auth */}
                alex@example.com
              </Text>
              <FontAwesome name="lock" size={14} color={Colors.textMuted} />
            </View>
            <Text style={styles.fieldHint}>
              Email cannot be changed. Contact support if needed.
            </Text>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.lg,
    fontWeight: '600',
  },
  saveButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveText: {
    color: Colors.accent,
    fontSize: Typography.sizes.md,
    fontWeight: '600',
  },
  saveTextDisabled: {
    color: Colors.textMuted,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xxxl,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.xxxl,
    fontWeight: '600',
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  changePhotoText: {
    color: Colors.accent,
    fontSize: Typography.sizes.md,
    fontWeight: '500',
  },
  formSection: {
    paddingHorizontal: Spacing.lg,
  },
  fieldContainer: {
    marginBottom: Spacing.lg,
  },
  fieldLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.sm,
    fontWeight: '500',
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
  },
  input: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: Typography.sizes.md,
    paddingVertical: Spacing.md,
  },
  inputDisabled: {
    backgroundColor: Colors.glass,
  },
  inputDisabledText: {
    flex: 1,
    color: Colors.textMuted,
    fontSize: Typography.sizes.md,
    paddingVertical: Spacing.md,
  },
  fieldHint: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.xs,
    marginTop: Spacing.xs,
    marginLeft: Spacing.xs,
  },
});
