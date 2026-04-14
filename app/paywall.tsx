import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  Image,
  Linking,
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

import { useSubscription } from '@/hooks/useSubscription';

import { Button } from '@/components/Button';
import { RequireAuth } from '@/components/RequireAuth';
import { Toast } from '@/components/Toast';
import { MOCK_WORLDS } from '@/constants/mockData';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { type PaywallReason, trackEvent } from '@/lib/analytics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type BillingPeriod = 'yearly' | 'monthly';

const TERMS_URL = 'https://www.worlding.fun/terms';
const PRIVACY_URL = 'https://www.worlding.fun/privacy';

const PAYWALL_REASONS: PaywallReason[] = [
  'create_second_world',
  'throwbacks',
  'drop_export',
  'highlights',
  'relive',
  'storage_limit',
  'restore_purchase',
  'unknown',
];

const isPaywallReason = (value: string): value is PaywallReason =>
  PAYWALL_REASONS.includes(value as PaywallReason);

const formatCurrency = (amount: number, currency: string): string => {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
};

/**
 * Redesigned Paywall - World-Class Conversion
 *
 * Philosophy:
 * - Show value BEFORE price
 * - Emotional connection (memories, not features)
 * - Social proof builds trust
 * - Clear pricing with a single CTA
 * - Single clear CTA
 *
 * Inspired by: Notion, Superhuman, Calm, Things
 */
export default function PaywallScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ reason?: string }>();
  const { annualPackage, monthlyPackage, purchasePackage, restorePurchases } =
    useSubscription();
  const [selectedPeriod, setSelectedPeriod] = useState<BillingPeriod>('yearly');
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const reason = useMemo<PaywallReason>(() => {
    if (typeof params.reason === 'string' && isPaywallReason(params.reason)) {
      return params.reason;
    }
    return 'unknown';
  }, [params.reason]);

  const selectedPackage = selectedPeriod === 'yearly' ? annualPackage : monthlyPackage;
  const hasPackages = Boolean(annualPackage || monthlyPackage);
  const storeLabel = Platform.OS === 'android'
    ? 'Managed by Google Play'
    : 'Managed by the App Store';

  useEffect(() => {
    if (!annualPackage && monthlyPackage) {
      setSelectedPeriod('monthly');
    }
    if (!monthlyPackage && annualPackage) {
      setSelectedPeriod('yearly');
    }
  }, [annualPackage, monthlyPackage]);

  useEffect(() => {
    trackEvent('paywall_impression', { reason });
  }, [reason]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToastMessage(message);
    setToastType(type);
  };

  const handleClose = () => {
    trackEvent('paywall_dismiss', { reason });
    router.back();
  };

  const handleSubscribe = async () => {
    if (!selectedPackage || isPurchasing) {
      showToast('Unable to load subscription options.', 'error');
      return;
    }

    setIsPurchasing(true);
    trackEvent('paywall_purchase_start', {
      reason,
      package: selectedPackage.identifier,
    });

    try {
      const result = await purchasePackage(selectedPackage);

      if (result.success) {
        trackEvent('paywall_purchase_success', { reason });
        router.back();
      } else if (result.cancelled) {
        trackEvent('paywall_dismiss', { reason });
      } else {
        trackEvent('paywall_purchase_fail', { reason, error: result.error });
        showToast(result.error ?? 'Purchase failed. Try again.', 'error');
      }
    } catch (error) {
      trackEvent('paywall_purchase_fail', { reason, error: String(error) });
      showToast('Purchase failed. Try again.', 'error');
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRestore = () => {
    restorePurchases()
      .then((result) => {
        if (result.success) {
          trackEvent('restore_success', { reason });
          showToast('Purchases restored.', 'success');
          return;
        }

        trackEvent('restore_fail', { reason, error: result.error });
        showToast(result.error ?? 'Restore failed. Try again.', 'error');
      })
      .catch((error) => {
        trackEvent('restore_fail', { reason, error: String(error) });
        showToast('Restore failed. Try again.', 'error');
      });
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
              <Ionicons name="close" size={18} color={Colors.textMuted} />
            </Pressable>
          </Animated.View>

          {/* Visual Hero - Show Product Value */}
          <ProductHero />

          {/* Headline */}
          <Animated.View entering={FadeInUp.delay(400).duration(500)} style={styles.headlineSection}>
            <Text style={styles.headline}>
              Keep everyone's photos{'\n'}in one place.
            </Text>
            <Text style={styles.subheadline}>
              Create unlimited Worlds and relive every trip, night out, and weekend together.
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
              icon="globe-outline"
              title="Unlimited Worlds"
              description="Your first World is free - create as many as you want after"
            />
            <ValueCard
              delay={700}
              icon="sparkles"
              title="Relive + Highlights + Drop"
              description="Cinematic replays, best shots picked, and shareable video drops"
            />
            <ValueCard
              delay={800}
              icon="time-outline"
              title="Throwbacks"
              description="Group memories brought back at the perfect time"
            />
          </View>

          {/* Pricing Section */}
          <Animated.View entering={FadeInUp.delay(900).duration(500)} style={styles.pricingSection}>
            <PricingToggle
              selectedPeriod={selectedPeriod}
              onPeriodChange={setSelectedPeriod}
            />

            <PricingDisplay period={selectedPeriod} rcPackage={selectedPackage} />

            {!hasPackages && (
              <Text style={styles.pricingError}>
                Can't load subscription options. Check your connection and try again.
              </Text>
            )}

            {/* CTA Button */}
            <Button
              title="Unlock Worlding+"
              subtitle={
                selectedPackage
                  ? `${selectedPeriod === 'yearly' ? 'Annual' : 'Monthly'} - ${selectedPackage.product.priceString}/${selectedPeriod === 'yearly' ? 'year' : 'month'}`
                  : 'Check connection to load pricing'
              }
              onPress={handleSubscribe}
              variant="primary"
              size="large"
              fullWidth
              loading={isPurchasing}
              disabled={!hasPackages || isPurchasing}
            />

            {/* Trust Signals */}
            <View style={styles.trustSignals}>
              <TrustItem text="Cancel anytime" />
              <View style={styles.trustDot} />
              <TrustItem text={storeLabel} />
            </View>
          </Animated.View>

          {/* Footer */}
          <Animated.View entering={FadeIn.delay(1000).duration(400)} style={styles.footer}>
            <Pressable onPress={handleRestore} style={styles.restoreButton}>
              <Text style={styles.restoreText}>Restore Purchases</Text>
            </Pressable>
            <Text style={styles.terms}>
              <Text style={styles.termsLink} onPress={() => Linking.openURL(TERMS_URL)}>
                Terms of Service
              </Text>
              {' | '}
              <Text style={styles.termsLink} onPress={() => Linking.openURL(PRIVACY_URL)}>
                Privacy Policy
              </Text>
            </Text>
          </Animated.View>
        </ScrollView>

        <Toast
          message={toastMessage ?? ''}
          visible={toastMessage !== null}
          type={toastType}
          onHide={() => setToastMessage(null)}
        />
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
  icon: keyof typeof Ionicons.glyphMap;
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
          <Ionicons name={icon} size={24} color={Colors.accent} />
        </View>
        <View style={styles.valueContent}>
          <Text style={styles.valueTitle}>{title}</Text>
          <Text style={styles.valueDescription}>{description}</Text>
        </View>
        <View style={styles.valueCheck}>
          <Ionicons name="checkmark" size={14} color={Colors.success} />
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
            <Text style={styles.saveBadgeText}>Best value </Text>
            <Ionicons name="gift" size={12} color={Colors.textPrimary} />
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
  rcPackage: {
    product: {
      priceString: string;
      price: number;
      currencyCode?: string;
    };
  } | null;
}

function PricingDisplay({ period, rcPackage }: PricingDisplayProps) {
  const isYearly = period === 'yearly';
  const priceString = rcPackage?.product.priceString ?? '--';
  const priceNumber = typeof rcPackage?.product.price === 'number'
    ? rcPackage.product.price
    : null;
  const currencyCode = rcPackage?.product.currencyCode ?? 'USD';
  const breakdown = isYearly && priceNumber
    ? `Just ${formatCurrency(priceNumber / 12, currencyCode)}/month`
    : isYearly
      ? 'Billed yearly'
      : 'Billed monthly';

  return (
    <Animated.View
      key={period}
      entering={FadeIn.duration(300)}
      style={styles.priceDisplay}
    >
      <View style={styles.priceRow}>
        <Text style={styles.price}>{priceString}</Text>
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
      <Ionicons name="checkmark" size={12} color={Colors.success} />
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
    flexDirection: 'row',
    alignItems: 'center',
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
  pricingError: {
    color: Colors.textMuted,
    fontSize: Typography.sizes.sm,
    textAlign: 'center',
    marginBottom: Spacing.md,
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
  termsLink: {
    color: 'rgba(255, 255, 255, 0.5)',
    textDecorationLine: 'underline',
  },
});
