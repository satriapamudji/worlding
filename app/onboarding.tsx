import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, type Href } from 'expo-router';
import React, { useState, useRef } from 'react';
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  SlideInRight,
  SlideOutLeft,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { LegalModal } from '@/components';
import { Colors, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { useOnboarding } from '@/hooks/useOnboarding';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * Onboarding - Story-driven introduction
 *
 * Based on product doc:
 * - Problem: Photos scatter across phones after group experiences
 * - Solution: Auto-Collect, Worlds, Relive
 *
 * 5 slides:
 * 1. Hook - The pain point
 * 2. Problem - Visual of scattered photos
 * 3. Solution - Auto-Collect magic
 * 4. Feature - Worlds organization
 * 5. CTA - Get started
 */

interface SlideData {
  id: string;
  type: 'problem' | 'solution' | 'feature' | 'cta';
  badge?: string;
  title: string;
  subtitle: string;
  visual: 'scattered' | 'collecting' | 'world' | 'relive' | 'cta';
}

const SLIDES: SlideData[] = [
  {
    id: 'problem',
    type: 'problem',
    badge: 'Sound familiar?',
    title: "Your best photos are\ntrapped on friends' phones",
    subtitle: "After every trip, night out, or weekend away — photos stay scattered. You never get them all.",
    visual: 'scattered',
  },
  {
    id: 'collect',
    type: 'solution',
    badge: 'Introducing',
    title: "Everyone's photos.\nAlready there.",
    subtitle: "Worlding automatically collects photos from everyone in your group. No uploading. No asking.",
    visual: 'collecting',
  },
  {
    id: 'worlds',
    type: 'feature',
    badge: 'Organized by memory',
    title: "One World for\neach experience",
    subtitle: "Not folders. Not dates. Worlds — organized by what actually happened. The trip. The party. The weekend.",
    visual: 'world',
  },
  {
    id: 'relive',
    type: 'feature',
    badge: 'More than storage',
    title: "Relive it together",
    subtitle: "When everyone's photos are in one place, you can actually experience the memory again — together.",
    visual: 'relive',
  },
  {
    id: 'cta',
    type: 'cta',
    title: "Stop losing your\nbest memories",
    subtitle: "Create your first World and bring everyone's photos together.",
    visual: 'cta',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [legalModalType, setLegalModalType] = useState<'terms' | 'privacy' | null>(null);
  const { markComplete } = useOnboarding();

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);
    if (index !== currentIndex && index >= 0 && index < SLIDES.length) {
      setCurrentIndex(index);
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  };

  const handleNext = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (currentIndex < SLIDES.length - 1) {
      scrollViewRef.current?.scrollTo({
        x: (currentIndex + 1) * SCREEN_WIDTH,
        animated: true,
      });
    } else {
      handleGetStarted();
    }
  };

  const handleSkip = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await markComplete();
    router.replace('/auth' as Href);
  };

  const handleGetStarted = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    await markComplete();
    router.replace('/auth' as Href);
  };

  const isLastSlide = currentIndex === SLIDES.length - 1;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Skip Button */}
      {!isLastSlide && (
        <Pressable style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      )}

      {/* Slides */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        bounces={false}
      >
        {SLIDES.map((slide, index) => (
          <SlideView
            key={slide.id}
            slide={slide}
            isActive={index === currentIndex}
          />
        ))}
      </ScrollView>

      {/* Bottom Section */}
      <View style={[styles.bottomSection, { paddingBottom: insets.bottom + Spacing.lg }]}>
        {/* Progress Dots */}
        <View style={styles.progressDots}>
          {SLIDES.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === currentIndex ? styles.dotActive : styles.dotInactive
              ]}
            />
          ))}
        </View>

        {/* CTA Button */}
        <Pressable
          style={styles.ctaButton}
          onPress={handleNext}
        >
          <LinearGradient
            colors={[Colors.accent, Colors.accentDark]}
            style={styles.ctaGradient}
          >
            <Text style={styles.ctaText}>
              {isLastSlide ? 'Get Started' : 'Continue'}
            </Text>
          </LinearGradient>
        </Pressable>

        {/* Terms */}
        <Text style={styles.termsText}>
          By continuing, you agree to our{' '}
          <Text style={styles.termsLink} onPress={() => setLegalModalType('terms')}>
            Terms
          </Text>
          {' & '}
          <Text style={styles.termsLink} onPress={() => setLegalModalType('privacy')}>
            Privacy Policy
          </Text>
        </Text>
      </View>

      {/* Legal Modal */}
      <LegalModal
        visible={legalModalType !== null}
        type={legalModalType || 'terms'}
        onClose={() => setLegalModalType(null)}
      />
    </View>
  );
}

interface SlideViewProps {
  slide: SlideData;
  isActive: boolean;
}

function SlideView({ slide, isActive }: SlideViewProps) {
  return (
    <View style={styles.slide}>
      {/* Visual */}
      <View style={styles.visualContainer}>
        {slide.visual === 'scattered' && <ScatteredVisual />}
        {slide.visual === 'collecting' && <CollectingVisual />}
        {slide.visual === 'world' && <WorldVisual />}
        {slide.visual === 'relive' && <ReliveVisual />}
        {slide.visual === 'cta' && <CTAVisual />}
      </View>

      {/* Content */}
      <View style={styles.contentContainer}>
        {slide.badge && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{slide.badge}</Text>
          </View>
        )}
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.subtitle}>{slide.subtitle}</Text>
      </View>
    </View>
  );
}

// Visual: Scattered photos (problem)
function ScatteredVisual() {
  const cards = [
    { gradient: ['#4A1A6B', '#2D1B4E'] as const, rotation: -12, x: -60, y: -40 },
    { gradient: ['#1A3A5C', '#0F2744'] as const, rotation: 8, x: 50, y: -60 },
    { gradient: ['#3D2B1F', '#261A12'] as const, rotation: -5, x: -40, y: 50 },
    { gradient: ['#1F3D3D', '#122626'] as const, rotation: 15, x: 60, y: 40 },
  ];

  return (
    <View style={styles.scatteredContainer}>
      {cards.map((card, index) => (
        <Animated.View
          key={index}
          entering={FadeInUp.delay(index * 100).springify()}
          style={[
            styles.scatteredPhoto,
            {
              transform: [
                { rotate: `${card.rotation}deg` },
                { translateX: card.x },
                { translateY: card.y },
              ],
              zIndex: index,
            }
          ]}
        >
          <LinearGradient
            colors={[card.gradient[0], card.gradient[1]]}
            style={styles.scatteredImage}
          >
            {/* Abstract photo icon */}
            <View style={styles.photoIcon}>
              <View style={styles.photoIconMountain} />
              <View style={styles.photoIconSun} />
            </View>
          </LinearGradient>
          {/* Phone indicator */}
          <View style={styles.phoneIndicator}>
            <View style={styles.phoneDot} />
          </View>
        </Animated.View>
      ))}
      {/* Question marks */}
      <Animated.View
        entering={FadeIn.delay(500)}
        style={[styles.questionMark, { top: 20, left: 30 }]}
      >
        <Ionicons name="help" size={32} color={Colors.textMuted} style={{ opacity: 0.3 }} />
      </Animated.View>
      <Animated.View
        entering={FadeIn.delay(600)}
        style={[styles.questionMark, { bottom: 40, right: 40 }]}
      >
        <Ionicons name="help" size={32} color={Colors.textMuted} style={{ opacity: 0.3 }} />
      </Animated.View>
    </View>
  );
}

// Visual: Collecting animation (solution)
function CollectingVisual() {
  const cardGradients = [
    ['#FF573D', '#CC3D2A'] as const,
    ['#8B5CF6', '#6D43D4'] as const,
    ['#06B6D4', '#0891A8'] as const,
    ['#10B981', '#0A8C62'] as const,
  ];

  return (
    <View style={styles.collectingContainer}>
      {/* Center card stack */}
      <View style={styles.cardStack}>
        {cardGradients.map((gradient, index) => (
          <Animated.View
            key={index}
            entering={FadeInDown.delay(200 + index * 150).springify()}
            style={[
              styles.stackCard,
              {
                zIndex: cardGradients.length - index,
                transform: [
                  { scale: 1 - index * 0.05 },
                  { translateY: index * -8 },
                ],
              }
            ]}
          >
            <LinearGradient
              colors={[gradient[0], gradient[1]]}
              style={styles.stackImage}
            >
              {/* Camera icon */}
              <View style={styles.cameraIcon}>
                <View style={styles.cameraBody} />
                <View style={styles.cameraLens} />
              </View>
            </LinearGradient>
          </Animated.View>
        ))}
      </View>
      {/* Magic sparkles */}
      <Animated.View
        entering={FadeIn.delay(800)}
        style={[styles.sparkle, { top: 40, right: 60 }]}
      >
        <Ionicons name="sparkles" size={24} color={Colors.accent} />
      </Animated.View>
      <Animated.View
        entering={FadeIn.delay(900)}
        style={[styles.sparkle, { bottom: 60, left: 50 }]}
      >
        <Ionicons name="sparkles" size={24} color={Colors.accent} />
      </Animated.View>
    </View>
  );
}

// Visual: World card (feature)
function WorldVisual() {
  return (
    <View style={styles.worldVisualContainer}>
      <Animated.View
        entering={FadeInUp.delay(200).springify()}
        style={styles.worldCard}
      >
        <LinearGradient
          colors={['#8B5CF6', '#4A1A6B', '#1A0A2E']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.worldCardImage}
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)']}
          style={styles.worldCardGradient}
        />
        <View style={styles.worldCardContent}>
          <View style={styles.worldCardBadge}>
            <Text style={styles.worldCardBadgeText}>Dec 15 - 22</Text>
          </View>
          <Text style={styles.worldCardTitle}>Tokyo 2024</Text>
          <View style={styles.worldCardMeta}>
            <View style={styles.avatarStack}>
              <View style={[styles.avatar, { backgroundColor: '#FF573D' }]} />
              <View style={[styles.avatar, { backgroundColor: '#8B5CF6', marginLeft: -8 }]} />
              <View style={[styles.avatar, { backgroundColor: '#06B6D4', marginLeft: -8 }]} />
            </View>
            <Text style={styles.worldCardMetaText}>156 photos</Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

// Visual: Relive experience (feature)
function ReliveVisual() {
  return (
    <View style={styles.reliveContainer}>
      <Animated.View
        entering={FadeInUp.delay(200).springify()}
        style={styles.relivePhone}
      >
        <LinearGradient
          colors={['#FF573D', '#CC3D2A', '#8B2A1D']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.reliveImage}
        />
        {/* Play button overlay */}
        <View style={styles.reliveOverlay}>
          <LinearGradient
            colors={[Colors.accent, Colors.accentDark]}
            style={styles.relivePlayButton}
          >
            <View style={styles.playTriangle} />
          </LinearGradient>
        </View>
        {/* Timeline dots */}
        <View style={styles.reliveTimeline}>
          <View style={[styles.timelineDot, styles.timelineDotActive]} />
          <View style={styles.timelineDot} />
          <View style={styles.timelineDot} />
          <View style={styles.timelineDot} />
          <View style={styles.timelineDot} />
        </View>
      </Animated.View>
    </View>
  );
}

// Visual: CTA final screen
function CTAVisual() {
  return (
    <View style={styles.ctaVisualContainer}>
      <Animated.View
        entering={FadeIn.delay(200).duration(600)}
        style={styles.logoContainer}
      >
        <LinearGradient
          colors={[Colors.accent, Colors.accentDark]}
          style={styles.logoGradient}
        >
          <Text style={styles.logoText}>W</Text>
        </LinearGradient>
        <Text style={styles.logoName}>Worlding</Text>
      </Animated.View>
      <Animated.Text
        entering={FadeIn.delay(400)}
        style={styles.ctaTagline}
      >
        All your group's photos. One place. Zero effort.
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Skip Button
  skipButton: {
    position: 'absolute',
    top: 60,
    right: Spacing.lg,
    zIndex: 100,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  skipText: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.md,
    fontWeight: '500',
  },

  // Slides
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    justifyContent: 'flex-start',
  },
  visualContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  contentContainer: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
    alignItems: 'center',
  },
  badge: {
    backgroundColor: Colors.glass,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    marginBottom: Spacing.md,
  },
  badgeText: {
    color: Colors.accent,
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: Spacing.md,
    lineHeight: 38,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.md,
    textAlign: 'center',
    lineHeight: Typography.sizes.md * 1.5,
    maxWidth: 320,
  },

  // Bottom Section
  bottomSection: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.lg,
  },
  progressDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: Colors.accent,
    width: 24,
  },
  dotInactive: {
    backgroundColor: Colors.glass,
  },
  ctaButton: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    ...Shadows.glow,
  },
  ctaGradient: {
    paddingVertical: Spacing.md + 2,
    alignItems: 'center',
  },
  ctaText: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.md,
    fontWeight: '600',
  },
  termsText: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.xs,
    textAlign: 'center',
  },
  termsLink: {
    color: 'rgba(255, 255, 255, 0.5)',
    textDecorationLine: 'underline',
  },

  // Scattered Visual
  scatteredContainer: {
    width: 300,
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scatteredPhoto: {
    position: 'absolute',
    width: 120,
    height: 160,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    ...Shadows.md,
  },
  scatteredImage: {
    width: '100%',
    height: '100%',
  },
  phoneIndicator: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  phoneDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.textSecondary,
  },
  questionMark: {
    position: 'absolute',
  },
  photoIcon: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoIconMountain: {
    width: 0,
    height: 0,
    borderLeftWidth: 20,
    borderRightWidth: 20,
    borderBottomWidth: 24,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'rgba(255,255,255,0.3)',
  },
  photoIconSun: {
    position: 'absolute',
    top: 40,
    right: 30,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },

  // Collecting Visual
  collectingContainer: {
    width: 280,
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardStack: {
    width: 200,
    height: 260,
    alignItems: 'center',
  },
  stackCard: {
    position: 'absolute',
    width: 180,
    height: 240,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    ...Shadows.lg,
  },
  stackImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraIcon: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraBody: {
    width: 40,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  cameraLens: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  sparkle: {
    position: 'absolute',
  },

  // World Visual
  worldVisualContainer: {
    width: SCREEN_WIDTH,
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  worldCard: {
    width: '100%',
    maxWidth: 320,
    height: 220,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    ...Shadows.lg,
  },
  worldCardImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  worldCardGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
  },
  worldCardContent: {
    position: 'absolute',
    bottom: Spacing.lg,
    left: Spacing.lg,
    right: Spacing.lg,
  },
  worldCardBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
    marginBottom: Spacing.xs,
  },
  worldCardBadgeText: {
    color: Colors.textPrimary,
    fontSize: 11,
    fontWeight: '600',
  },
  worldCardTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.xl,
    fontWeight: 'bold',
    marginBottom: Spacing.sm,
  },
  worldCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  avatarStack: {
    flexDirection: 'row',
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.background,
  },
  worldCardMetaText: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.sm,
  },

  // Relive Visual
  reliveContainer: {
    width: SCREEN_WIDTH,
    alignItems: 'center',
  },
  relivePhone: {
    width: 240,
    height: 320,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    ...Shadows.lg,
    borderWidth: 3,
    borderColor: Colors.surface,
  },
  reliveImage: {
    width: '100%',
    height: '100%',
  },
  reliveOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  relivePlayButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playTriangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 16,
    borderTopWidth: 10,
    borderBottomWidth: 10,
    borderLeftColor: Colors.textPrimary,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    marginLeft: 4,
  },
  reliveTimeline: {
    position: 'absolute',
    bottom: Spacing.lg,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  timelineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  timelineDotActive: {
    backgroundColor: Colors.textPrimary,
    width: 20,
  },

  // CTA Visual
  ctaVisualContainer: {
    alignItems: 'center',
    gap: Spacing.lg,
  },
  logoContainer: {
    alignItems: 'center',
    gap: Spacing.md,
  },
  logoGradient: {
    width: 80,
    height: 80,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    color: Colors.textPrimary,
    fontSize: 40,
    fontWeight: 'bold',
  },
  logoName: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.xxl,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  ctaTagline: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.md,
    textAlign: 'center',
    maxWidth: 280,
  },
});
