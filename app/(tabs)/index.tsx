import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useMemo, useState, useCallback } from 'react';
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  RefreshControl,
  Platform,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { GlassCard, WorldCard } from '@/components';
import { CURRENT_USER, MOCK_WORLDS } from '@/constants/mockData';
import { Colors, Radius, Shadows, Spacing, Typography } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Home Screen - Your Worlds
 *
 * Design Principles:
 * - Content-first: Worlds are the heroes
 * - Minimal chrome: Clean header, no redundant elements
 * - Breathing room: Generous spacing
 * - Delightful micro-interactions
 */

function getTimeBasedGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return 'Night owl';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Night owl';
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const createButtonScale = useSharedValue(1);

  const handleWorldPress = (worldId: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push(`/world/${worldId}`);
  };

  const handleWorldLongPress = (worldId: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    // TODO: Replace with action sheet (Pin, Rename, Share, etc.)
    console.log('Long-pressed world:', worldId);
  };

  const handleCreatePress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push('/(tabs)/create');
  };

  const handleScanPress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push('/scan');
  };

  const handleCreatePressIn = () => {
    createButtonScale.value = withSpring(0.95, { damping: 15, stiffness: 400 });
  };

  const handleCreatePressOut = () => {
    createButtonScale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  const createButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: createButtonScale.value }],
  }));

  const handleRefresh = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 700);
  }, []);

  const firstName = CURRENT_USER.name.split(' ')[0];

  const summaryLine = useMemo(() => {
    if (!MOCK_WORLDS.length) return '';
    const worldCount = MOCK_WORLDS.length;
    const photoCount = MOCK_WORLDS.reduce((acc, w) => acc + w.photoCount, 0);
    const worldLabel = worldCount === 1 ? 'World' : 'Worlds';
    const memoryLabel = photoCount === 1 ? 'memory' : 'memories';
    return `${worldCount} ${worldLabel} • ${photoCount} ${memoryLabel}`;
  }, []);

  // Split worlds into active/building vs archived
  const { activeWorlds, archivedWorlds } = useMemo(() => {
    const active = MOCK_WORLDS.filter(w => w.state === 'active' || w.state === 'building');
    const archived = MOCK_WORLDS.filter(w => w.state === 'archived');
    return { activeWorlds: active, archivedWorlds: archived };
  }, []);

  // Get displayed worlds based on active tab
  const displayedWorlds = activeTab === 'active' ? activeWorlds : archivedWorlds;

  const handleTabPress = (tab: 'active' | 'archived') => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setActiveTab(tab);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            tintColor={Colors.textSecondary}
            progressViewOffset={insets.top + 40}
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
          />
        }
      >
        {/* Header - Minimal & Personal */}
        <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
          {/* Top Row: Avatar + Greeting + Scan */}
          <View style={styles.topRow}>
            <Pressable style={styles.avatarButton}>
              {CURRENT_USER.avatar ? (
                <Animated.Image
                  source={{ uri: CURRENT_USER.avatar }}
                  style={styles.avatar}
                />
              ) : (
                <LinearGradient
                  colors={[Colors.accent, Colors.accentDark]}
                  style={styles.avatar}
                >
                  <Text style={styles.avatarText}>
                    {firstName.slice(0, 1)}
                  </Text>
                </LinearGradient>
              )}
            </Pressable>
            <View style={styles.greetingContainer}>
              <Text style={styles.greeting}>
                {getTimeBasedGreeting()}, {firstName}
              </Text>
              {!!summaryLine && (
                <Text style={styles.greetingMeta}>{summaryLine}</Text>
              )}
            </View>
            <Pressable style={styles.scanButton} onPress={handleScanPress}>
              <View style={styles.scanIconContainer}>
                {/* QR Viewfinder icon - 4 corner brackets */}
                <View style={[styles.scanCorner, styles.scanCornerTL]} />
                <View style={[styles.scanCorner, styles.scanCornerTR]} />
                <View style={[styles.scanCorner, styles.scanCornerBL]} />
                <View style={[styles.scanCorner, styles.scanCornerBR]} />
              </View>
            </Pressable>
          </View>
        </Animated.View>

        {/* Worlds List */}
        {MOCK_WORLDS.length > 0 ? (
          <View style={styles.worldsSection}>
            {/* Tab Row */}
            <View style={styles.tabRow}>
              <Pressable
                onPress={handleCreatePress}
                onPressIn={handleCreatePressIn}
                onPressOut={handleCreatePressOut}
              >
                <Animated.View style={[styles.newWorldChip, createButtonStyle]}>
                  <Text style={styles.newWorldPlus}>+</Text>
                  <Text style={styles.newWorldText}>New</Text>
                </Animated.View>
              </Pressable>

              {/* Spacer to push tabs to the right */}
              <View style={styles.tabSpacer} />

              <Pressable
                style={[
                  styles.tabChip,
                  activeTab === 'active' && styles.tabChipActive,
                ]}
                onPress={() => handleTabPress('active')}
              >
                <Text style={[
                  styles.tabChipText,
                  activeTab === 'active' && styles.tabChipTextActive,
                ]}>
                  Happening Now
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.tabChip,
                  activeTab === 'archived' && styles.tabChipActive,
                ]}
                onPress={() => handleTabPress('archived')}
              >
                <Text style={[
                  styles.tabChipText,
                  activeTab === 'archived' && styles.tabChipTextActive,
                ]}>
                  Memories
                </Text>
              </Pressable>
            </View>

            {/* Filtered Worlds List */}
            {displayedWorlds.length > 0 ? (
              <View style={styles.worldsList}>
                {displayedWorlds.map((world, index) => (
                  <WorldCard
                    key={world.id}
                    id={world.id}
                    title={world.title}
                    coverUri={world.coverUri}
                    dateRange={world.dateRange}
                    photoCount={world.photoCount}
                    members={world.members}
                    state={world.state}
                    index={index}
                    onPress={handleWorldPress}
                    onLongPress={handleWorldLongPress}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.emptyTabState}>
                <Text style={styles.emptyTabText}>
                  {activeTab === 'active' 
                    ? 'No active worlds right now' 
                    : 'No memories yet'}
                </Text>
              </View>
            )}
          </View>
        ) : (
          /* Empty State - Story-driven */
          <Animated.View entering={FadeInUp.delay(200)} style={styles.emptyState}>
            {/* Hero visual */}
            <View style={styles.emptyVisual}>
              <View style={styles.emptyPhotoStack}>
                <View style={[styles.emptyPhoto, styles.emptyPhoto3]} />
                <View style={[styles.emptyPhoto, styles.emptyPhoto2]} />
                <View style={[styles.emptyPhoto, styles.emptyPhoto1]}>
                  <Text style={styles.emptyPhotoIcon}>+</Text>
                </View>
              </View>
            </View>

            {/* Content */}
            <View style={styles.emptyContent}>
              <Text style={styles.emptyTitle}>Your memories, together</Text>
              <Text style={styles.emptySubtitle}>
                After a trip or night out, everyone's photos stay on their phones.{' '}
                <Text style={styles.emptySubtitleBold}>Worlding brings them together.</Text>
              </Text>
            </View>

            {/* CTA */}
            <View style={styles.emptyCta}>
              <Pressable
                onPress={handleCreatePress}
                onPressIn={handleCreatePressIn}
                onPressOut={handleCreatePressOut}
              >
                <Animated.View style={createButtonStyle}>
                  <LinearGradient
                    colors={[Colors.accent, Colors.accentDark]}
                    style={styles.createButtonGradient}
                  >
                    <Text style={styles.createButtonText}>Create Your First World</Text>
                  </LinearGradient>
                </Animated.View>
              </Pressable>

              {/* Value props */}
              <View style={styles.valueProps}>
                <View style={styles.valueProp}>
                  <Text style={styles.valuePropIcon}>✨</Text>
                  <Text style={styles.valuePropText}>Auto-collects photos</Text>
                </View>
                <View style={styles.valuePropDot} />
                <View style={styles.valueProp}>
                  <Text style={styles.valuePropIcon}>👥</Text>
                  <Text style={styles.valuePropText}>Everyone's photos</Text>
                </View>
              </View>
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },

  // Header - Personal & Welcoming
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatarButton: {
    ...Shadows.sm,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  avatarText: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.lg,
    fontWeight: '600',
  },
  greetingContainer: {
    flex: 1,
  },
  greeting: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.xl,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  greetingMeta: {
    marginTop: 2,
    color: Colors.textMuted,
    fontSize: Typography.sizes.sm,
  },

  // Scan Button
  scanButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.glass,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanIconContainer: {
    width: 20,
    height: 20,
    position: 'relative',
  },
  scanCorner: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderColor: Colors.textPrimary,
  },
  scanCornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderTopLeftRadius: 2,
  },
  scanCornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderTopRightRadius: 2,
  },
  scanCornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderBottomLeftRadius: 2,
  },
  scanCornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderBottomRightRadius: 2,
  },

  // Worlds List
  worldsSection: {
    paddingTop: Spacing.lg,
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  tabSpacer: {
    flex: 1,
  },
  tabChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: Colors.glass,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  tabChipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  tabChipText: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
  },
  tabChipTextActive: {
    color: Colors.textPrimary,
  },
  worldsHeaderRow: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  worldsTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.lg,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  newWorldChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: Colors.accent,
  },
  newWorldPlus: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.md,
    fontWeight: '600',
    marginTop: -1,
  },
  newWorldText: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
  },
  worldsList: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.lg,
  },
  emptyTabState: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xxl,
    alignItems: 'center',
  },
  emptyTabText: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.md,
  },

  // Empty State
  emptyState: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl,
    alignItems: 'center',
  },

  // Empty Visual - Photo Stack
  emptyVisual: {
    marginBottom: Spacing.xxl,
    alignItems: 'center',
  },
  emptyPhotoStack: {
    width: 200,
    height: 160,
    position: 'relative',
  },
  emptyPhoto: {
    position: 'absolute',
    width: 120,
    height: 140,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.md,
  },
  emptyPhoto1: {
    left: 40,
    top: 0,
    zIndex: 3,
    backgroundColor: Colors.surfaceElevated,
  },
  emptyPhoto2: {
    left: 60,
    top: 10,
    zIndex: 2,
    transform: [{ rotate: '8deg' }],
  },
  emptyPhoto3: {
    left: 20,
    top: 15,
    zIndex: 1,
    transform: [{ rotate: '-8deg' }],
  },
  emptyPhotoIcon: {
    fontSize: 32,
    color: Colors.textMuted,
  },

  // Empty Content
  emptyContent: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  emptyTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.xxl,
    fontWeight: 'bold',
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.md,
    textAlign: 'center',
    lineHeight: Typography.sizes.md * 1.6,
    paddingHorizontal: Spacing.md,
  },
  emptySubtitleBold: {
    color: Colors.textPrimary,
    fontWeight: '600',
  },

  // Empty CTA
  emptyCta: {
    alignItems: 'center',
    width: '100%',
  },
  createButton: {
    ...Shadows.glowSubtle,
  },
  createButtonGradient: {
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.lg,
    borderRadius: Radius.xl,
  },
  createButtonText: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.md,
    fontWeight: '700',
  },

  // Value Props
  valueProps: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xl,
    gap: Spacing.md,
  },
  valueProp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  valuePropIcon: {
    fontSize: 14,
  },
  valuePropText: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.sm,
  },
  valuePropDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.textMuted,
    opacity: 0.5,
  },
});
