import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInUp, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';

type LegalContentType = 'terms' | 'privacy';

interface LegalModalProps {
  visible: boolean;
  onClose: () => void;
  type: LegalContentType;
}

const TERMS_OF_SERVICE = `Last updated: December 2025

Welcome to Worlding! By using our app, you agree to these terms. Please read them carefully.

1. What Worlding Is
Worlding is a collaborative photo-sharing app that lets groups of people contribute photos to shared albums called "Worlds." Each World has a defined time period and location, and multiple people can contribute photos to tell a collective story.

2. Your Account
You must be at least 13 years old to use Worlding. You are responsible for maintaining the security of your account and for all activities that occur under your account. Please use a strong password and don't share your login credentials.

3. Content You Share
When you upload photos to Worlding:
- You retain ownership of your photos
- You grant Worlding a license to store, display, and share your photos with other World members
- You confirm you have the right to share those photos
- You agree not to upload content that is illegal, harmful, or violates others' rights

4. Worlds and Collaboration
When you join or create a World:
- All members can view photos contributed to that World
- The World creator can manage membership and settings
- Leaving a World means you lose access to its shared content
- Your contributed photos may remain visible to other members

5. Acceptable Use
You agree not to:
- Use Worlding for any illegal purpose
- Harass, bully, or harm other users
- Upload malicious content or spam
- Attempt to access other users' accounts
- Reverse engineer or hack the app
- Use automated tools to access the service

6. Subscriptions and Payments
Some features require a paid subscription:
- Subscriptions are billed through the App Store or Play Store
- Prices are displayed before purchase
- Subscriptions auto-renew unless cancelled
- Refunds are handled by Apple or Google per their policies

7. Termination
We may suspend or terminate your account if you violate these terms. You may delete your account at any time through the app settings.

8. Disclaimers
Worlding is provided "as is" without warranties. We don't guarantee the service will always be available or error-free. We're not responsible for content posted by other users.

9. Limitation of Liability
To the maximum extent permitted by law, Worlding's liability is limited to the amount you paid for the service in the past 12 months.

10. Changes to Terms
We may update these terms occasionally. We'll notify you of significant changes through the app. Continued use after changes means you accept the new terms.

11. Contact
Questions? Reach us at contact@worlding.fun

Thank you for being part of Worlding!`;

const PRIVACY_POLICY = `Last updated: December 2025

Your privacy matters to us. This policy explains how Worlding collects, uses, and protects your information.

1. Information We Collect

Account Information:
- Email address (for login and communication)
- Display name and profile photo (optional)
- Authentication data from Apple/Google if you use social login

Content You Create:
- Photos you upload to Worlds
- World names, dates, and locations you set
- Comments or captions you add

Usage Information:
- App interactions (features used, screens visited)
- Device information (model, OS version)
- Crash reports and performance data

2. What We Don't Collect
- We don't access your full photo library - only photos you explicitly upload
- We don't track your location in the background
- We don't sell your personal information to third parties
- We don't read your private messages (we don't have messaging)

3. How We Use Your Information

To provide the service:
- Store and display your photos in Worlds
- Connect you with other World members
- Send important account notifications

To improve Worlding:
- Understand how features are used
- Fix bugs and improve performance
- Develop new features

4. How Photos Work

Your photos are:
- Stored securely in the cloud
- Visible to members of the World they're in
- Not used for advertising or sold to third parties
- Deleted from our servers if you remove them or delete your account

Photo metadata:
- We may use date/time to organize photos chronologically
- Location data helps group photos by place (if enabled)
- You can disable location metadata in your device settings

5. Sharing Your Information

We share information only when:
- You choose to share with World members
- Required by law or legal process
- Necessary to protect safety or prevent fraud
- With service providers who help run Worlding (under strict agreements)

We don't share your information with advertisers or data brokers.

6. Data Storage and Security

Your data is:
- Stored on secure cloud servers (Supabase/AWS)
- Encrypted in transit and at rest
- Protected by industry-standard security measures
- Backed up regularly

7. Your Rights and Choices

You can:
- Access your data through the app
- Update or correct your information
- Delete your account and data
- Export your photos before deleting
- Opt out of non-essential communications

8. Children's Privacy
Worlding is not intended for children under 13. We don't knowingly collect information from children under 13. If we learn we have, we'll delete it promptly.

9. International Users
Worlding operates globally. Your data may be transferred to and processed in countries other than your own, with appropriate safeguards in place.

10. Changes to This Policy
We may update this policy occasionally. We'll notify you of significant changes through the app. Check this page for the latest version.

11. Contact Us
Privacy questions? Email us at contact@worlding.fun

We're committed to protecting your privacy while helping you share meaningful moments with the people who matter.`;

/**
 * LegalModal - Full-screen modal for displaying Terms of Service or Privacy Policy
 *
 * Features:
 * - Blurred backdrop
 * - Scrollable content
 * - Close button in header
 * - Safe area aware
 */
export function LegalModal({ visible, onClose, type }: LegalModalProps) {
  const insets = useSafeAreaInsets();
  const title = type === 'terms' ? 'Terms of Service' : 'Privacy Policy';
  const content = type === 'terms' ? TERMS_OF_SERVICE : PRIVACY_POLICY;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Backdrop */}
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={styles.backdrop}
        >
          <BlurView intensity={30} style={styles.blur} tint="dark" />
        </Animated.View>

        {/* Content */}
        <Animated.View
          entering={SlideInUp.springify().damping(20).stiffness(150)}
          exiting={SlideOutDown.duration(200)}
          style={[
            styles.content,
            {
              paddingTop: insets.top + Spacing.md,
              paddingBottom: insets.bottom + Spacing.lg,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.closeButtonPressed,
              ]}
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={24} color={Colors.textPrimary} />
            </Pressable>
          </View>

          {/* Scrollable Content */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
          >
            <Text style={styles.legalText}>{content}</Text>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  blur: {
    flex: 1,
  },
  content: {
    flex: 1,
    backgroundColor: Colors.surface,
    marginTop: 60,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: Typography.sizes.lg,
    fontWeight: '600',
    textAlign: 'center',
  },
  closeButton: {
    position: 'absolute',
    right: Spacing.lg,
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: Colors.glass,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  closeButtonPressed: {
    opacity: 0.7,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  legalText: {
    color: Colors.textSecondary,
    fontSize: Typography.sizes.sm,
    lineHeight: Typography.sizes.sm * Typography.lineHeights.relaxed,
  },
});

export default LegalModal;
