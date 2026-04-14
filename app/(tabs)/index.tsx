import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Linking from 'expo-linking';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  type AlertButton,
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
  withTiming,
  withRepeat,
  interpolateColor,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { Button, GlassCard, WorldCard } from '@/components';
import { Colors, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useNotificationPrefs } from '@/hooks/useNotificationPrefs';
import { getMyWorlds } from '@/lib/api/worlds';
import { logger } from '@/lib/logger';
import type { WorldWithDetails } from '@/lib/database.types';
import { requestPushPermission } from '@/lib/notifications';

/**
 * Home Screen - Cinematic Personal Gallery
 *
 * Design Upgrade:
 * - "Ambient Light" header background
 * - Editorial Typography (Large Greetings)
 * - Glassmorphic Action Pills
 * - Minimalist Text Tabs
 */

function getTimeBasedGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return 'Late Night';
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  if (hour < 21) return 'Good Evening';
  return 'Good Night';
}

function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
  const startDay = start.getDate();
  const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
  const endDay = end.getDate();
  
  if (startMonth === endMonth) {
    return `${startMonth} ${startDay} - ${endDay}`;
  }
  return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
}

function transformWorldForCard(world: WorldWithDetails) {
  return {
    id: world.id,
    title: world.title,
    coverUri: world.cover_url || 'https://images.unsplash.com/photo-1682687220742-aba13b6e50ba?w=800',
    dateRange: formatDateRange(world.start_date, world.end_date),
    photoCount: world.media_count || 0,
    members: world.members.map(m => ({
      id: m.user_id,
      name: m.profile?.name || 'Unknown',
      avatar: m.profile?.avatar_url || undefined,
    })),
    state: world.state,
  };
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { prefs: notificationPrefs, loading: notificationLoading, updatePrefs: updateNotificationPrefs } = useNotificationPrefs();
  
  const [worlds, setWorlds] = useState<WorldWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [isRequestingNotifications, setIsRequestingNotifications] = useState(false);
  
  // Animation values
  const createButtonScale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.3);

  useEffect(() => {
    glowOpacity.value = withRepeat(
      withTiming(0.6, { duration: 3000 }),
      -1,
      true
    );
  }, []);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const fetchWorlds = useCallback(async () => {
    const { data, error } = await getMyWorlds();
    if (error) {
      logger.world.warn('Failed to fetch worlds', { error });
    } else {
      logger.world.info('Fetched worlds', { count: data?.length ?? 0 });
      setWorlds(data || []);
    }
    setIsLoading(false);
    setIsRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchWorlds();
    }, [fetchWorlds])
  );

  const handleWorldPress = (worldId: string) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/world/${worldId}`);
  };

  const handleWorldLongPress = (worldId: string) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    logger.world.debug('Long-pressed world', { worldId });
  };

  const handleCreatePress = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(tabs)/create');
  };

  const handleJoinPress = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/join');
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
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsRefreshing(true);
    fetchWorlds();
  }, [fetchWorlds]);

  const firstName = profile?.name?.split(' ')[0] || 'there';
  const showNotificationPrompt = !notificationLoading
    && !notificationPrefs.prompted
    && !notificationPrefs.pushEnabled;

  const handleEnableNotifications = () => {
    if (isRequestingNotifications) return;
    setIsRequestingNotifications(true);
    updateNotificationPrefs({ prompted: true });

    requestPushPermission()
      .then((permission) => {
        if (permission.granted) {
          updateNotificationPrefs({ pushEnabled: true });
        } else {
          updateNotificationPrefs({ pushEnabled: false });
          if (!permission.canAskAgain) {
            const actions: AlertButton[] = [{ text: 'Not now', style: 'cancel' }];
            if (Platform.OS !== 'web') {
              actions.push({ text: 'Open Settings', onPress: () => Linking.openSettings() });
            }
            Alert.alert(
              'Enable Notifications',
              'Notifications are disabled at the system level. You can enable them in Settings.',
              actions
            );
          }
        }
      })
      .finally(() => {
        setIsRequestingNotifications(false);
      });
  };

  const handleDismissNotifications = () => {
    updateNotificationPrefs({ prompted: true });
  };

  // Derived state
  const { activeWorlds, archivedWorlds } = useMemo(() => {
    const active = worlds.filter(w => w.state === 'active' || w.state === 'building');
    const archived = worlds.filter(w => w.state === 'archived');
    return { activeWorlds: active, archivedWorlds: archived };
  }, [worlds]);

  const displayedWorlds = activeTab === 'active' ? activeWorlds : archivedWorlds;

  const handleTabPress = (tab: 'active' | 'archived') => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    setActiveTab(tab);
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Cinematic Ambient Background */}
      <Animated.View style={[styles.ambientGlowContainer, glowStyle]}>
        <LinearGradient
          colors={[Colors.accent, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.ambientGlowTopLeft}
        />
        <LinearGradient
          colors={['#4F46E5', 'transparent']} // Indigo secondary glow for depth
          start={{ x: 1, y: 1 }}
          end={{ x: 0, y: 0 }}
          style={styles.ambientGlowBottomRight}
        />
      </Animated.View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + Spacing.md }]}
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
        {/* Cinematic Header */}
        <Animated.View entering={FadeIn.duration(800)} style={styles.header}>
          <View style={styles.headerTop}>
            {/* Avatar - Minimal Glass */}
            <Pressable onPress={() => router.push('/(tabs)/profile')} style={styles.avatarButton}>
              {profile?.avatar_url ? (
                <Animated.Image
                  source={{ uri: profile.avatar_url }}
                  style={styles.avatar}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>
                    {firstName.slice(0, 1).toUpperCase()}
                  </Text>
                </View>
              )}
            </Pressable>
            
            {/* Action Pills - Unified Glass Toolbar */}
            <View style={styles.headerActions}>
               {/* Join World Action */}
              <Pressable
                onPress={handleJoinPress}
                style={({ pressed }) => [
                  styles.glassAction,
                  pressed && styles.actionPressed,
                ]}
              >
                {Platform.OS !== 'web' ? (
                  <BlurView intensity={25} tint="dark" style={styles.glassActionInner}>
                    <Ionicons name="scan-outline" size={16} color={Colors.textPrimary} />
                    <Text style={styles.glassActionText}>Join World</Text>
                  </BlurView>
                ) : (
                  <View style={[styles.glassActionInner, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                    <Ionicons name="scan-outline" size={16} color={Colors.textPrimary} />
                    <Text style={styles.glassActionText}>Join World</Text>
                  </View>
                )}
              </Pressable>

              {/* Create Action - Primary */}
              <Pressable
                onPress={handleCreatePress}
                onPressIn={handleCreatePressIn}
                onPressOut={handleCreatePressOut}
              >
                <Animated.View style={[styles.createAction, createButtonStyle]}>
                  <LinearGradient
                    colors={[Colors.accent, Colors.accentDark]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.createActionGradient}
                  >
                    <Ionicons name="add" size={18} color={Colors.textPrimary} />
                    <Text style={styles.createActionText}>Create</Text>
                  </LinearGradient>
                </Animated.View>
              </Pressable>
            </View>
          </View>

          {/* Editorial Greeting - Refined Typography */}
          <View style={styles.greetingSection}>
            <Text style={styles.greetingLabel}>{getTimeBasedGreeting()}</Text>
            <Text style={styles.greetingName} numberOfLines={1} adjustsFontSizeToFit>
              {firstName}
            </Text>
          </View>
        </Animated.View>

        {showNotificationPrompt && (
          <Animated.View entering={FadeInUp.delay(120).duration(400)} style={styles.notificationsPrompt}>
            <GlassCard variant="elevated">
              <View style={styles.promptContent}>
                <Text style={styles.promptTitle}>Stay in the loop</Text>
                <Text style={styles.promptSubtitle}>
                  Get a nudge when friends add photos or invite you to a World.
                </Text>
                <View style={styles.promptActions}>
                  <Button
                    title="Enable"
                    size="small"
                    onPress={handleEnableNotifications}
                    loading={isRequestingNotifications}
                    disabled={isRequestingNotifications}
                  />
                  <Pressable onPress={handleDismissNotifications} style={styles.promptDismiss}>
                    <Text style={styles.promptDismissText}>Not now</Text>
                  </Pressable>
                </View>
              </View>
            </GlassCard>
          </Animated.View>
        )}

        {/* Minimalist Tabs */}
        {worlds.length > 0 && (
          <View style={styles.tabSection}>
            <Pressable 
              onPress={() => handleTabPress('active')}
              style={styles.tabItem}
            >
              <Text style={[
                styles.tabText, 
                activeTab === 'active' && styles.tabTextActive
              ]}>
                HAPPENING NOW
              </Text>
              {activeTab === 'active' && (
                <Animated.View entering={FadeIn} style={styles.tabIndicator} />
              )}
            </Pressable>

            <Pressable 
              onPress={() => handleTabPress('archived')}
              style={styles.tabItem}
            >
              <Text style={[
                styles.tabText, 
                activeTab === 'archived' && styles.tabTextActive
              ]}>
                MEMORIES
              </Text>
              {activeTab === 'archived' && (
                <Animated.View entering={FadeIn} style={styles.tabIndicator} />
              )}
            </Pressable>
          </View>
        )}

        {/* Content Area */}
        {worlds.length > 0 ? (
          <View style={styles.worldsList}>
            {displayedWorlds.length > 0 ? (
              displayedWorlds.map((world, index) => {
                const cardData = transformWorldForCard(world);
                return (
                  <WorldCard
                    key={world.id}
                    id={cardData.id}
                    title={cardData.title}
                    coverUri={cardData.coverUri}
                    dateRange={cardData.dateRange}
                    photoCount={cardData.photoCount}
                    members={cardData.members}
                    state={cardData.state}
                    index={index}
                    onPress={handleWorldPress}
                    onLongPress={handleWorldLongPress}
                  />
                );
              })
            ) : (
              <View style={styles.emptyTabState}>
                <Ionicons name={activeTab === 'active' ? 'planet-outline' : 'images-outline'} size={48} color={Colors.textMuted} style={{ opacity: 0.5 }} />
                <Text style={styles.emptyTabText}>
                  {activeTab === 'active' 
                    ? 'No worlds active right now' 
                    : 'No memories archived yet'}
                </Text>
              </View>
            )}
          </View>
        ) : (
          /* Empty State - Refined */
          <Animated.View entering={FadeInUp.delay(200)} style={styles.emptyState}>
            <View style={styles.emptyPhotoStack}>
              <View style={[styles.emptyPhoto, styles.emptyPhoto3]} />
              <View style={[styles.emptyPhoto, styles.emptyPhoto2]} />
              <View style={[styles.emptyPhoto, styles.emptyPhoto1]}>
                <Ionicons name="camera-outline" size={32} color={Colors.textMuted} />
              </View>
            </View>
            
            <Text style={styles.emptyTitle}>Your Gallery Awaits</Text>
            <Text style={styles.emptySubtitle}>
              Create a world to collect everyone's photos from your next event.
            </Text>

             <Pressable
                onPress={handleCreatePress}
                onPressIn={handleCreatePressIn}
                onPressOut={handleCreatePressOut}
                style={{ marginTop: Spacing.xl }}
              >
                <Animated.View style={createButtonStyle}>
                  <LinearGradient
                    colors={[Colors.accent, Colors.accentDark]}
                    style={styles.createButtonLarge}
                  >
                    <Ionicons name="add" size={20} color={Colors.textPrimary} />
                    <Text style={styles.createButtonTextLarge}>Start First World</Text>
                  </LinearGradient>
                </Animated.View>
              </Pressable>
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
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  
  // Ambient Glow
  ambientGlowContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  ambientGlowTopLeft: {
    position: 'absolute',
    top: -100,
    left: -100,
    width: 600,
    height: 500,
    borderRadius: 300,
    opacity: 0.12,
    transform: [{ scaleX: 1.5 }],
  },
  ambientGlowBottomRight: {
    position: 'absolute',
    bottom: -100,
    right: -100,
    width: 500,
    height: 500,
    borderRadius: 300,
    opacity: 0.08,
    transform: [{ scaleX: 1.2 }],
  },

  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },

  // Header
  header: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  avatarButton: {
    ...Shadows.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  avatarText: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
  },

  // Header Actions
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  glassAction: {
    borderRadius: Radius.full,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  glassActionInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  glassActionText: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  createAction: {
    borderRadius: Radius.full,
    ...Shadows.glowSubtle,
  },
  createActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9, 
    borderRadius: Radius.full,
  },
  createActionText: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  actionPressed: {
    opacity: 0.8,
  },

  // Greeting - Editorial Style
  greetingSection: {
    marginTop: Spacing.xs,
  },
  greetingLabel: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    opacity: 0.9,
  },
  greetingName: {
    color: Colors.textPrimary,
    fontSize: 38,
    fontWeight: '300', // Lighter weight for elegance
    letterSpacing: -1.5,
    lineHeight: 44,
  },

  // Notifications Prompt
  notificationsPrompt: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  promptContent: {
    gap: Spacing.sm,
  },
  promptTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.md,
    fontWeight: '600',
  },
  promptSubtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.sm,
    lineHeight: Typography.sizes.sm * 1.5,
  },
  promptActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  promptDismiss: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  promptDismissText: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.sm,
    fontWeight: '500',
  },

  // Tabs
  tabSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
    gap: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  tabItem: {
    paddingVertical: Spacing.md,
    position: 'relative',
  },
  tabText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  tabTextActive: {
    color: Colors.textPrimary,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: Colors.accent,
    borderRadius: Radius.full,
  },

  // Lists
  worldsList: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xl, // More breathing room between cards
  },
  emptyTabState: {
    paddingVertical: Spacing.xxl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  emptyTabText: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.md,
  },

  // Empty State
  emptyState: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    alignItems: 'center',
  },
  emptyPhotoStack: {
    width: 160,
    height: 140,
    position: 'relative',
    marginBottom: Spacing.xl,
  },
  emptyPhoto: {
    position: 'absolute',
    width: 100,
    height: 120,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.md,
  },
  emptyPhoto1: {
    left: 30,
    top: 0,
    zIndex: 3,
    backgroundColor: Colors.surfaceElevated,
    transform: [{ rotate: '-5deg' }],
  },
  emptyPhoto2: {
    left: 45,
    top: 10,
    zIndex: 2,
    transform: [{ rotate: '5deg' }],
  },
  emptyPhoto3: {
    left: 15,
    top: 15,
    zIndex: 1,
    transform: [{ rotate: '-10deg' }],
  },
  emptyTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.xl,
    fontWeight: '700',
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.md,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 280,
  },
  createButtonLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.lg,
    borderRadius: Radius.full,
    ...Shadows.glowSubtle,
  },
  createButtonTextLarge: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.md,
    fontWeight: '700',
  },
});
