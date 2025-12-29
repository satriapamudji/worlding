import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { Toast } from '@/components';
import { Colors, Radius, Shadows, Spacing, Typography } from '@/constants/theme';

/**
 * QR Scanner Screen
 * 
 * Features:
 * - Full-screen camera with viewfinder
 * - Flashlight toggle
 * - Permission handling with settings link
 * - Error toast for invalid QR codes
 */
export default function ScanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [showErrorToast, setShowErrorToast] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleBack = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.back();
  };

  const handleToggleTorch = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setTorchOn(!torchOn);
  };

  const handleOpenSettings = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    Linking.openSettings();
  };

  const isValidWorldingInvite = (data: string): boolean => {
    // Accept various formats:
    // - https://worlding.app/invite/CODE or https://worlding.app/join/CODE
    // - worlding://invite/CODE or worlding://join/CODE
    // - Just a code (alphanumeric, 6-20 chars)
    if (
      data.includes('worlding.app/invite/') ||
      data.includes('worlding://invite/') ||
      data.includes('worlding.app/join/') ||
      data.includes('worlding://join/')
    ) {
      return true;
    }
    // Simple code format
    if (/^[A-Za-z0-9]{6,20}$/.test(data)) {
      return true;
    }
    return false;
  };

  const extractInviteCode = (data: string): string => {
    // Extract code from URL (supports both /invite/ and /join/ patterns)
    const urlMatch = data.match(/(?:invite|join)\/([A-Za-z0-9]+)/);
    if (urlMatch) {
      return urlMatch[1];
    }
    // Assume it's just the code
    return data;
  };

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    
    setScanned(true);
    
    if (isValidWorldingInvite(data)) {
      // Success!
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      const code = extractInviteCode(data);
      router.replace({
        pathname: '/join',
        params: { code },
      });
    } else {
      // Invalid QR
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      setErrorMessage('Invalid QR code');
      setShowErrorToast(true);
      // Allow retry after a short delay
      setTimeout(() => {
        setScanned(false);
      }, 1500);
    }
  };

  // Permission not yet determined
  if (!permission) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Requesting camera access...</Text>
        </View>
      </View>
    );
  }

  // Permission denied
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
          <Pressable style={styles.headerButton} onPress={handleBack}>
            <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Scan QR Code</Text>
          <View style={styles.headerButtonPlaceholder} />
        </View>

        {/* Permission Denied State */}
        <View style={styles.permissionContainer}>
          <View style={styles.permissionIconContainer}>
            <View style={styles.cameraIcon}>
              <View style={styles.cameraBody} />
              <View style={styles.cameraLens} />
            </View>
          </View>
          <Text style={styles.permissionTitle}>Camera Access Needed</Text>
          <Text style={styles.permissionText}>
            To scan QR codes and join Worlds, please allow camera access in your device settings.
          </Text>
          <Pressable style={styles.settingsButton} onPress={handleOpenSettings}>
            <Text style={styles.settingsButtonText}>Open Settings</Text>
          </Pressable>
          {!permission.granted && permission.canAskAgain && (
            <Pressable style={styles.retryButton} onPress={requestPermission}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  // Permission granted - show camera
  return (
    <View style={styles.container}>
      {/* Camera */}
      <CameraView
        style={styles.camera}
        facing="back"
        enableTorch={torchOn}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      {/* Overlay */}
      <View style={styles.overlay}>
        {/* Header */}
        <Animated.View 
          entering={FadeIn.duration(300)}
          style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}
        >
          <Pressable style={styles.headerButton} onPress={handleBack}>
            <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Scan QR Code</Text>
          <Pressable style={styles.headerButton} onPress={handleToggleTorch}>
            <Ionicons 
              name={torchOn ? "flashlight" : "flashlight-outline"} 
              size={22} 
              color={torchOn ? Colors.accent : Colors.textPrimary} 
            />
          </Pressable>
        </Animated.View>

        {/* Viewfinder Area */}
        <View style={styles.viewfinderContainer}>
          {/* Top dark area */}
          <View style={styles.darkArea} />
          
          {/* Middle row with viewfinder */}
          <View style={styles.middleRow}>
            <View style={styles.darkArea} />
            <View style={styles.viewfinder}>
              {/* Corner brackets */}
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
            </View>
            <View style={styles.darkArea} />
          </View>
          
          {/* Bottom dark area */}
          <View style={styles.darkArea} />
        </View>

        {/* Instructions */}
        <View style={[styles.instructionsContainer, { paddingBottom: insets.bottom + Spacing.xl }]}>
          <Text style={styles.instructions}>
            Point at a World invite code
          </Text>
        </View>
      </View>

      {/* Error Toast */}
      <Toast
        message={errorMessage}
        visible={showErrorToast}
        duration={1500}
        onHide={() => setShowErrorToast(false)}
        icon="✕"
      />
    </View>
  );
}

const VIEWFINDER_SIZE = 250;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButtonPlaceholder: {
    width: 44,
    height: 44,
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.lg,
    fontWeight: '600',
  },

  // Viewfinder
  viewfinderContainer: {
    flex: 1,
  },
  darkArea: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  middleRow: {
    flexDirection: 'row',
    height: VIEWFINDER_SIZE,
  },
  viewfinder: {
    width: VIEWFINDER_SIZE,
    height: VIEWFINDER_SIZE,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: Colors.textPrimary,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: Radius.md,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: Radius.md,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: Radius.md,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: Radius.md,
  },

  // Instructions
  instructionsContainer: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingTop: Spacing.xl,
    alignItems: 'center',
  },
  instructions: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.md,
    textAlign: 'center',
  },

  // Loading State
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.md,
  },

  // Permission Denied State
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  permissionIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cameraIcon: {
    width: 36,
    height: 28,
    position: 'relative',
  },
  cameraBody: {
    width: 36,
    height: 24,
    backgroundColor: Colors.textMuted,
    borderRadius: 6,
    position: 'absolute',
    bottom: 0,
  },
  cameraLens: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 2,
    borderColor: Colors.textSecondary,
    position: 'absolute',
    bottom: 5,
    left: 11,
  },
  permissionTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.xl,
    fontWeight: 'bold',
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  permissionText: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.md,
    textAlign: 'center',
    lineHeight: Typography.sizes.md * 1.5,
    marginBottom: Spacing.xl,
  },
  settingsButton: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    marginBottom: Spacing.md,
  },
  settingsButtonText: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.md,
    fontWeight: '600',
  },
  retryButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  retryButtonText: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.md,
    fontWeight: '500',
  },
});
