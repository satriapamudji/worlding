import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Dimensions,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RequireAuth } from '@/components/RequireAuth';
import { Button } from '@/components/Button';
import { MOCK_WORLDS, CURRENT_USER } from '@/constants/mockData';
import { Colors, Radius, Shadows, Spacing, Typography } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type BillingPeriod = 'yearly' | 'monthly';

/**
 * Redesigned Paywall - World-Class Conversion
 *
 * Philosophy:
 * - Show value BEFORE price
 * - Emotional connection (memories, not features)
 * - Social proof builds trust
 * - Free trial removes risk
 * - Single clear CTA
 *
 * Inspired by: Notion, Superhuman, Calm, Things
 */
export default function PaywallScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedPeriod, setSelectedPeriod] = useState<BillingPeriod>('yearly');

  const handleClose = () => {
    router.back();
  };

  const handleSubscribe = () => {
    // TODO: Implement subscription with RevenueCat/Superwall
    console.log('Subscribe to:', selectedPeriod);
    router.back();
  };

  const handleRestore = () => {
    // TODO: Implement restore purchases
    console.log('Restore purchases');
  };

  return (
    <RequireAuth>
      <View style={styles.container}>
        {/* Gradient Background */}
        <LinearGradient
          colors={['#050505', '#0A0A0A', '#050505']}
          style={StyleSheet.absoluteFill}
        />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + Spacing.xl }
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Close Button */}
          <Animated.View entering={FadeIn.delay(200)} style={styles.closeButtonContainer}>
            <Pressable style={styles.closeButton} onPress={handleClose}>
              <Text style={styles.closeIcon}>✕</Text>
            </Pressable>
          </Animated.View>

          {/* Visual Hero - Show Product Value */}
          <ProductHero />

          {/* Headline */}
          <Animated.View entering={FadeInUp.delay(400).duration(500)} style={styles.headlineSection}>
            <Text style={styles.headline}>
              Ready for unlimited{'\n'}Worlds?
            </Text>
            <Text style={styles.subheadline}>
              Keep creating memories with unlimited Worlds, Throwbacks, and AI Highlights
            </Text>
          </Animated.View>

          {/* Social Proof Banner */}
          <Animated.View entering={FadeInUp.delay(500).duration(400)}>
            <View style={styles.socialProof}>
              <View style={styles.socialProofAvatars}>
                <View style={[styles.socialAvatar, { zIndex: 3 }]} />
                <View style={[styles.socialAvatar, { zIndex: 2, marginLeft: -10 }]} />
                <View style={[styles.socialAvatar, { zIndex: 1, marginLeft: -10 }]} />
              </View>
              <Text style={styles.socialProofText}>
                Join <Text style={styles.socialProofBold}>50,000+</Text> memory makers
              </Text>
            </View>
          </Animated.View>

          {/* Value Proposition Cards */}
          <View style={styles.valueSection}>
            <ValueCard
              delay={600}
              icon="🌍"
              title="Keep the magic going"
              description="Create unlimited Worlds for every trip, weekend, and moment worth remembering"
            />
            <ValueCard
              delay={700}
              icon="🔔"
              title="Never forget a moment"
              description="Get Throwback notifications with your group's best photos from this day in history"
            />
            <ValueCard
              delay={800}
              icon="✨"
              title="Auto-highlights, done for you"
              description="AI finds your best shots and creates beautiful highlight reels automatically"
            />
          </View>

          {/* Pricing Section */}
          <Animated.View entering={FadeInUp.delay(900).duration(500)} style={styles.pricingSection}>
            <PricingToggle
              selectedPeriod={selectedPeriod}
              onPeriodChange={setSelectedPeriod}
            />

            <PricingDisplay period={selectedPeriod} />

            {/* CTA Button */}
            <Button
              title="Try 7 Days Free"
              subtitle={`Then ${selectedPeriod === 'yearly' ? '$29.99/year' : '$3.99/month'}`}
              onPress={handleSubscribe}
              variant="primary"
              size="large"
              fullWidth
            />

            {/* Trust Signals */}
            <View style={styles.trustSignals}>
              <TrustItem text="Cancel anytime" />
              <View style={styles.trustDot} />
              <TrustItem text="No credit card for trial" />
            </View>
          </Animated.View>

          {/* Footer */}
          <Animated.View entering={FadeIn.delay(1000).duration(400)} style={styles.footer}>
            <Pressable onPress={handleRestore} style={styles.restoreButton}>
              <Text style={styles.restoreText}>Restore Purchases</Text>
            </Pressable>
            <Text style={styles.terms}>Terms of Service • Privacy Policy</Text>
          </Animated.View>
        </ScrollView>
      </View>
    </RequireAuth>
  );
}

/**
 * Visual Hero - Shows actual product value
 * Animated photo grid demonstrating multiplayer
 */
function ProductHero() {
  const photos = MOCK_WORLDS[0]?.photos.slice(0, 6) || [];

  return (
    <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.heroContainer}>
      <View style={styles.heroGrid}>
        {photos.map((photo, index) => (
          <Animated.View
            key={photo.id}
            entering={FadeInUp.delay(300 + index * 50).springify()}
            style={styles.heroPhotoWrapper}
          >
            <Image source={{ uri: photo.uri }} style={styles.heroPhoto} />
            {/* Glassmorphic overlay showing multiplayer */}
            {index === 0 && (
              <BlurView intensity={15} style={styles.heroOverlay} tint="dark">
                <View style={styles.heroOverlayContent}>
                  <Text style={styles.heroOverlayText}>+156 photos</Text>
                  <View style={styles.heroAvatarStack}>
                    <View style={styles.heroMiniAvatar} />
                    <View style={[styles.heroMiniAvatar, { marginLeft: -6 }]} />
                  </View>
                </View>
              </BlurView>
            )}
          </Animated.View>
        ))}
      </View>

      {/* Subtle gradient fade at bottom */}
      <LinearGradient
        colors={['rgba(5,5,5,0)', 'rgba(5,5,5,1)']}
        style={styles.heroGradient}
        pointerEvents="none"
      />
    </Animated.View>
  );
}

/**
 * Value Proposition Card
 * Shows outcomes, not features
 */
interface ValueCardProps {
  delay: number;
  icon: string;
  title: string;
  description: string;
}

function ValueCard({ delay, icon, title, description }: ValueCardProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  return (
    <Animated.View
      entering={FadeInUp.delay(delay).springify()}
      style={animatedStyle}
    >
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.valueCard}
      >
        <View style={styles.valueIconContainer}>
          <Text style={styles.valueIcon}>{icon}</Text>
        </View>
        <View style={styles.valueContent}>
          <Text style={styles.valueTitle}>{title}</Text>
          <Text style={styles.valueDescription}>{description}</Text>
        </View>
        <View style={styles.valueCheck}>
          <Text style={styles.valueCheckmark}>✓</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/**
 * Pricing Toggle - Yearly/Monthly
 * Premium iOS-style segmented control with haptics
 */
interface PricingToggleProps {
  selectedPeriod: BillingPeriod;
  onPeriodChange: (period: BillingPeriod) => void;
}

function PricingToggle({ selectedPeriod, onPeriodChange }: PricingToggleProps) {
  const slideX = useSharedValue(selectedPeriod === 'yearly' ? 0 : 1);
  const yearlyScale = useSharedValue(selectedPeriod === 'yearly' ? 1 : 0.95);
  const monthlyScale = useSharedValue(selectedPeriod === 'monthly' ? 1 : 0.95);

  const pillStyle = useAnimatedStyle(() => {
    const translateX = interpolate(
      slideX.value,
      [0, 1],
      [2, SCREEN_WIDTH / 2 - Spacing.lg - 2],
      Extrapolate.CLAMP
    );
    return {
      transform: [{ translateX }],
    };
  });

  const yearlyTextOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(slideX.value, [0, 1], [1, 0.6]),
  }));

  const monthlyTextOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(slideX.value, [0, 1], [0.6, 1]),
  }));

  const yearlyButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: yearlyScale.value }],
  }));

  const monthlyButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: monthlyScale.value }],
  }));

  const handleToggle = (period: BillingPeriod) => {
    if (period === selectedPeriod) return;

    // Haptic feedback
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    onPeriodChange(period);
    slideX.value = withSpring(period === 'yearly' ? 0 : 1, {
      damping: 20,
      stiffness: 300,
    });
  };

  const handleYearlyPressIn = () => {
    yearlyScale.value = withSpring(0.96);
  };

  const handleYearlyPressOut = () => {
    yearlyScale.value = withSpring(selectedPeriod === 'yearly' ? 1 : 0.95);
  };

  const handleMonthlyPressIn = () => {
    monthlyScale.value = withSpring(0.96);
  };

  const handleMonthlyPressOut = () => {
    monthlyScale.value = withSpring(selectedPeriod === 'monthly' ? 1 : 0.95);
  };

  return (
    <View style={styles.toggleOuterContainer}>
      <View style={styles.toggleContainer}>
        {/* Animated Background Pill */}
        <Animated.View style={[styles.togglePill, pillStyle]}>
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.12)', 'rgba(255, 255, 255, 0.06)']}
            style={styles.togglePillGradient}
          />
        </Animated.View>

        {/* Toggle Options */}
        <Pressable
          style={styles.toggleOption}
          onPress={() => handleToggle('yearly')}
          onPressIn={handleYearlyPressIn}
          onPressOut={handleYearlyPressOut}
        >
          <Animated.View style={[styles.toggleOptionContent, yearlyButtonStyle]}>
            <Animated.Text
              style={[
                styles.toggleText,
                selectedPeriod === 'yearly' && styles.toggleTextActive,
                yearlyTextOpacity,
              ]}
            >
              Yearly
            </Animated.Text>
          </Animated.View>
        </Pressable>

        <Pressable
          style={styles.toggleOption}
          onPress={() => handleToggle('monthly')}
          onPressIn={handleMonthlyPressIn}
          onPressOut={handleMonthlyPressOut}
        >
          <Animated.View style={[styles.toggleOptionContent, monthlyButtonStyle]}>
            <Animated.Text
              style={[
                styles.toggleText,
                selectedPeriod === 'monthly' && styles.toggleTextActive,
                monthlyTextOpacity,
              ]}
            >
              Monthly
            </Animated.Text>
          </Animated.View>
        </Pressable>
      </View>

      {/* Save Badge - Separate from toggle */}
      {selectedPeriod === 'yearly' && (
        <Animated.View entering={FadeIn.duration(200)} style={styles.saveBadgeContainer}>
          <LinearGradient
            colors={[Colors.accent, Colors.accentDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.saveBadge}
          >
            <Text style={styles.saveBadgeText}>Save 40% 🎉</Text>
          </LinearGradient>
        </Animated.View>
      )}
    </View>
  );
}

/**
 * Pricing Display
 * Shows price clearly with breakdown
 */
interface PricingDisplayProps {
  period: BillingPeriod;
}

function PricingDisplay({ period }: PricingDisplayProps) {
  const isYearly = period === 'yearly';
  const price = isYearly ? '$29.99' : '$3.99';
  const breakdown = isYearly ? 'Just $2.50/month' : 'Billed monthly';

  return (
    <Animated.View
      key={period}
      entering={FadeIn.duration(300)}
      style={styles.priceDisplay}
    >
      <View style={styles.priceRow}>
        <Text style={styles.price}>{price}</Text>
        <Text style={styles.pricePeriod}>/{isYearly ? 'year' : 'month'}</Text>
      </View>
      <Text style={styles.priceBreakdown}>{breakdown}</Text>
    </Animated.View>
  );
}

/**
 * Trust Item
 * Small trust signal
 */
function TrustItem({ text }: { text: string }) {
  return (
    <View style={styles.trustItem}>
      <Text style={styles.trustCheck}>✓</Text>
      <Text style={styles.trustText}>{text}</Text>
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
    paddingHorizontal: Spacing.lg,
  },

  // Close Button
  closeButtonContainer: {
    alignItems: 'flex-end',
    paddingTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.glass,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIcon: {
    color: Colors.textMuted,
    fontSize: 16,
  },

  // Product Hero
  heroContainer: {
    marginBottom: Spacing.xl,
    position: 'relative',
  },
  heroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
  },
  heroPhotoWrapper: {
    width: (SCREEN_WIDTH - Spacing.lg * 2 - 6) / 3,
    height: 120,
    position: 'relative',
  },
  heroPhoto: {
    width: '100%',
    height: '100%',
    borderRadius: Radius.sm,
  },
  heroOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderBottomLeftRadius: Radius.sm,
    borderBottomRightRadius: Radius.sm,
  },
  heroOverlayContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroOverlayText: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.xs,
    fontWeight: '600',
  },
  heroAvatarStack: {
    flexDirection: 'row',
  },
  heroMiniAvatar: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.accent,
    borderWidth: 1,
    borderColor: Colors.background,
  },
  heroGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
  },

  // Headline
  headlineSection: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  headline: {
    color: Colors.textPrimary,
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 38,
    letterSpacing: -0.5,
    marginBottom: Spacing.md,
  },
  subheadline: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.md,
    textAlign: 'center',
    lineHeight: Typography.sizes.md * 1.6,
    maxWidth: 320,
  },

  // Social Proof
  socialProof: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.lg,
    backgroundColor: Colors.glass,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  socialProofAvatars: {
    flexDirection: 'row',
  },
  socialAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.accent,
    borderWidth: 2,
    borderColor: Colors.background,
  },
  socialProofText: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.sm,
  },
  socialProofBold: {
    color: Colors.textPrimary,
    fontWeight: '600',
  },

  // Value Cards
  valueSection: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  valueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    backgroundColor: Colors.glass,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    gap: Spacing.md,
  },
  valueIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  valueIcon: {
    fontSize: 24,
  },
  valueContent: {
    flex: 1,
  },
  valueTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.md,
    fontWeight: '600',
    marginBottom: 2,
  },
  valueDescription: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.sm,
    lineHeight: Typography.sizes.sm * 1.4,
  },
  valueCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  valueCheckmark: {
    color: Colors.success,
    fontSize: 14,
    fontWeight: '600',
  },

  // Pricing Section
  pricingSection: {
    marginBottom: Spacing.xl,
  },

  // Toggle
  toggleOuterContainer: {
    marginBottom: Spacing.md,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: Radius.xl,
    padding: 2,
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  togglePill: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: SCREEN_WIDTH / 2 - Spacing.lg - 2,
    height: 48,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  togglePillGradient: {
    flex: 1,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  toggleOption: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  toggleOptionContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleText: {
    fontSize: Typography.sizes.md,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  saveBadgeContainer: {
    alignItems: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  saveBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.xl,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  saveBadgeText: {
    color: Colors.textPrimary,
    fontSize: Typography.sizes.xs,
    fontWeight: '700',
  },

  // Price Display
  priceDisplay: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
    marginTop: Spacing.md,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  price: {
    color: Colors.textPrimary,
    fontSize: 56,
    fontWeight: '700',
    letterSpacing: -2,
  },
  pricePeriod: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.lg,
    marginLeft: 4,
  },
  priceBreakdown: {
    color: Colors.accent,
    fontSize: Typography.sizes.md,
    fontWeight: '600',
    marginTop: Spacing.xs,
  },

  // Trust Signals
  trustSignals: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  trustCheck: {
    color: Colors.success,
    fontSize: 12,
  },
  trustText: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.xs,
  },
  trustDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.textMuted,
    opacity: 0.5,
  },

  // Footer
  footer: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingTop: Spacing.lg,
  },
  restoreButton: {
    paddingVertical: Spacing.sm,
  },
  restoreText: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.sm,
    textDecorationLine: 'underline',
  },
  terms: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.xs,
  },
});
