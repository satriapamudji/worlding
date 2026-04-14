import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';

import { logger } from '@/lib/logger';

export const ENTITLEMENT_ID = 'worlding_plus';
export const OFFERING_ID = 'worlding_plus';

const DEV_ENV = 'development';

const getAppEnv = (): string | null =>
  process.env.EXPO_PUBLIC_APP_ENV ?? process.env.APP_ENV ?? null;

const isDevEnv = (): boolean => __DEV__ || getAppEnv() === DEV_ENV;

const getPlatformApiKey = (): string | null => {
  const iosKeyProd =
    process.env.EXPO_PUBLIC_REVENUECAT_PUBLIC_KEY_IOS ??
    process.env.REVENUECAT_PUBLIC_KEY_IOS ??
    null;
  const iosKeyDev =
    process.env.EXPO_PUBLIC_REVENUECAT_PUBLIC_KEY_IOS_DEV ??
    process.env.REVENUECAT_PUBLIC_KEY_IOS_DEV ??
    null;

  const androidKeyProd =
    process.env.EXPO_PUBLIC_REVENUECAT_PUBLIC_KEY_ANDROID ??
    process.env.REVENUECAT_PUBLIC_KEY_ANDROID ??
    null;
  const androidKeyDev =
    process.env.EXPO_PUBLIC_REVENUECAT_PUBLIC_KEY_ANDROID_DEV ??
    process.env.REVENUECAT_PUBLIC_KEY_ANDROID_DEV ??
    null;

  const useDevKey = isDevEnv();

  if (Platform.OS === 'ios') {
    return useDevKey ? iosKeyDev ?? iosKeyProd : iosKeyProd;
  }

  if (Platform.OS === 'android') {
    return useDevKey ? androidKeyDev ?? androidKeyProd : androidKeyProd;
  }

  return null;
};

export const configureRevenueCat = async (appUserId?: string | null): Promise<boolean> => {
  const apiKey = getPlatformApiKey();
  if (!apiKey) {
    logger.revenuecat.warn('Missing API key for current platform', { platform: Platform.OS });
    return false;
  }

  if (isDevEnv()) {
    Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
  }

  await Purchases.configure({
    apiKey,
    appUserID: appUserId ?? undefined,
  });

  return true;
};
