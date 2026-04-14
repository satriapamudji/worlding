import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ImagePicker, Toast } from '@/components';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { updateProfile, uploadAvatar } from '@/lib/api/profiles';
import { logger } from '@/lib/logger';

/**
 * Edit Profile Screen
 *
 * Features:
 * - Avatar with ImagePicker (tap to change)
 * - Name input field
 * - Email display (read-only)
 * - Save button in header
 * - Loading spinner during save
 * - Success/error toast feedback
 */
export default function EditProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile, refreshProfile } = useAuth();

  // Form state
  const [name, setName] = useState(profile?.name ?? '');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Toast state
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  // Derived values
  const currentAvatarUrl = profile?.avatar_url ?? null;
  const displayAvatar = avatarUri ?? currentAvatarUrl;
  const userEmail = user?.email ?? '';

  // Change tracking
  const hasNameChange = name.trim() !== (profile?.name ?? '');
  const hasAvatarChange = avatarUri !== null;
  const hasChanges = hasNameChange || hasAvatarChange;

  // Sync name state when profile loads
  useEffect(() => {
    if (profile?.name) {
      setName(profile.name);
    }
  }, [profile?.name]);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToastType(type);
    setToastMessage(message);
    setToastVisible(true);
  };

  const handleNameChange = (text: string) => {
    setName(text);
  };

  const handleSave = async () => {
    if (!hasChanges || isSaving) return;

    setIsSaving(true);
    try {
      // Upload avatar if changed
      if (hasAvatarChange && avatarUri) {
        const avatarResult = await uploadAvatar(avatarUri);
        if (avatarResult.error) {
          showToast('error', 'Failed to upload photo');
          setIsSaving(false);
          return;
        }
      }

      // Update name if changed
      if (hasNameChange) {
        const nameResult = await updateProfile({ name: name.trim() });
        if (nameResult.error) {
          showToast('error', 'Failed to update profile');
          setIsSaving(false);
          return;
        }
      }

      // Refresh profile in auth context
      await refreshProfile();

      // Show success toast, then navigate back
      logger.auth.info('Profile updated');
      showToast('success', 'Profile updated!');
      setTimeout(() => router.back(), 1500);
    } catch (error) {
      logger.auth.error('Failed to save profile', error);
      showToast('error', 'Something went wrong');
      setIsSaving(false);
    }
  };

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
          {isSaving ? (
            <View style={styles.avatarLoading}>
              <ActivityIndicator size="large" color={Colors.accent} />
            </View>
          ) : (
            <ImagePicker
              value={displayAvatar}
              onChange={setAvatarUri}
              placeholder="Add photo"
              icon="camera-outline"
              aspect={[1, 1]}
              size="large"
              shape="circle"
              allowsEditing={true}
              quality={0.8}
              showCamera={false}
            />
          )}
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
                editable={!isSaving}
              />
            </View>
          </View>

          {/* Email Field (Read-only) */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Email</Text>
            <View style={[styles.inputContainer, styles.inputDisabled]}>
              <Text style={styles.inputDisabledText}>
                {userEmail}
              </Text>
              <FontAwesome name="lock" size={14} color={Colors.textMuted} />
            </View>
            <Text style={styles.fieldHint}>
              Email cannot be changed. Contact support if needed.
            </Text>
          </View>
        </Animated.View>
      </ScrollView>

      {/* Toast */}
      <Toast
        message={toastMessage}
        visible={toastVisible}
        type={toastType}
        onHide={() => setToastVisible(false)}
      />
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
  avatarLoading: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
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
