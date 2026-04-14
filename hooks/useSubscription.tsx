import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Purchases from 'react-native-purchases';

import { SubscriptionSyncBanner } from '@/components/SubscriptionSyncBanner';
import { useAuth } from '@/hooks/useAuth';
import { trackEvent } from '@/lib/analytics';
import { logger } from '@/lib/logger';
import { configureRevenueCat, ENTITLEMENT_ID, OFFERING_ID } from '@/lib/revenuecat';

type Offerings = Awaited<ReturnType<typeof Purchases.getOfferings>>;
type CustomerInfo = Awaited<ReturnType<typeof Purchases.getCustomerInfo>>;
type Offering = NonNullable<Offerings['current']>;
type PurchasesPackage = Offering['availablePackages'][number];

type EntitlementStatus = 'active' | 'inactive' | 'unknown';
type PurchaseSyncStatus = 'idle' | 'syncing' | 'delayed';
type PaywallDisplayStatus = 'purchased' | 'restored' | 'cancelled' | 'error' | 'presented';

interface CachedEntitlement {
  isEntitled: boolean;
  lastVerifiedAt: number;
  expiresAt: string | null;
}

interface PurchaseResult {
  success: boolean;
  cancelled: boolean;
  error: string | null;
}

interface PaywallResult {
  status: PaywallDisplayStatus;
  error: string | null;
}

interface CustomerCenterResult {
  status: 'opened' | 'error';
  error: string | null;
}

interface SubscriptionContextValue {
  isEntitled: boolean;
  entitlementStatus: EntitlementStatus;
  entitlementExpiresAt: string | null;
  canAccessPaidFeatures: boolean;
  needsConnection: boolean;
  isLoading: boolean;
  lastVerifiedAt: number | null;
  offerings: Offerings | null;
  currentOffering: Offering | null;
  monthlyPackage: PurchasesPackage | null;
  annualPackage: PurchasesPackage | null;
  purchaseSyncStatus: PurchaseSyncStatus;
  refreshEntitlements: (source?: string) => Promise<void>;
  purchasePackage: (rcPackage: PurchasesPackage) => Promise<PurchaseResult>;
  restorePurchases: () => Promise<PurchaseResult>;
  presentPaywall: (source?: string) => Promise<PaywallResult>;
  presentCustomerCenter: (source?: string) => Promise<CustomerCenterResult>;
  markPurchaseSyncDelayed: () => void;
}

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

const ENTITLEMENT_CACHE_KEY = '@worlding/entitlement_cache';
const OFFLINE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;
const PURCHASE_SYNC_DELAY_MS = 30_000;
const PURCHASE_SYNC_MIN_DISPLAY_MS = 1500;

const getOfferingFromResults = (offerings: Offerings | null): Offering | null => {
  if (!offerings) return null;
  return offerings.all?.[OFFERING_ID] ?? offerings.current ?? null;
};

const findPackageByType = (
  packages: PurchasesPackage[],
  type: 'MONTHLY' | 'ANNUAL'
): PurchasesPackage | null => {
  const byType = packages.find((pkg) => pkg.packageType === type);
  if (byType) return byType;

  const match = type.toLowerCase();
  return packages.find((pkg) => pkg.identifier?.toLowerCase().includes(match)) ?? null;
};

interface SubscriptionProviderProps {
  children: ReactNode;
}

export function SubscriptionProvider({ children }: SubscriptionProviderProps) {
  const { user, profile } = useAuth();
  const [isConfigured, setIsConfigured] = useState(false);
  const [entitlementStatus, setEntitlementStatus] = useState<EntitlementStatus>('unknown');
  const [entitlementExpiresAt, setEntitlementExpiresAt] = useState<string | null>(null);
  const [offerings, setOfferings] = useState<Offerings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [cachedEntitlement, setCachedEntitlement] = useState<CachedEntitlement | null>(null);
  const [lastVerifiedAt, setLastVerifiedAt] = useState<number | null>(null);
  const [purchaseSyncStatus, setPurchaseSyncStatus] = useState<PurchaseSyncStatus>('idle');

  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncStartedAtRef = useRef<number | null>(null);
  const configuredRef = useRef(false);

  const clearSyncTimer = () => {
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }
  };

  const startPurchaseSync = useCallback(() => {
    clearSyncTimer();
    syncStartedAtRef.current = Date.now();
    setPurchaseSyncStatus('syncing');

    syncTimerRef.current = setTimeout(() => {
      setPurchaseSyncStatus((status) => (status === 'syncing' ? 'delayed' : status));
    }, PURCHASE_SYNC_DELAY_MS);
  }, []);

  const stopPurchaseSync = useCallback(() => {
    clearSyncTimer();
    syncStartedAtRef.current = null;
    setPurchaseSyncStatus('idle');
  }, []);

  const cacheEntitlement = useCallback(async (payload: CachedEntitlement) => {
    setCachedEntitlement(payload);
    setLastVerifiedAt(payload.lastVerifiedAt);
    setEntitlementExpiresAt(payload.expiresAt);
    await AsyncStorage.setItem(ENTITLEMENT_CACHE_KEY, JSON.stringify(payload));
  }, []);

  const applyCustomerInfo = useCallback(
    async (customerInfo: CustomerInfo) => {
      const activeEntitlement = customerInfo?.entitlements?.active?.[ENTITLEMENT_ID];
      const isEntitled = Boolean(activeEntitlement);
      const verifiedAt = Date.now();

      setEntitlementStatus(isEntitled ? 'active' : 'inactive');
      setEntitlementExpiresAt(activeEntitlement?.expirationDate ?? null);
      await cacheEntitlement({
        isEntitled,
        lastVerifiedAt: verifiedAt,
        expiresAt: activeEntitlement?.expirationDate ?? null,
      });
    },
    [cacheEntitlement]
  );

  const refreshEntitlements = useCallback(
    async (source = 'manual') => {
      if (!isConfigured) return;
      setIsLoading(true);

      try {
        const [customerInfo, offeringsResult] = await Promise.all([
          Purchases.getCustomerInfo(),
          Purchases.getOfferings(),
        ]);

        await applyCustomerInfo(customerInfo);
        setOfferings(offeringsResult);
        trackEvent('entitlement_refresh', { source, success: true });
      } catch (error) {
        setEntitlementStatus('unknown');
        trackEvent('entitlement_refresh', { source, success: false });
        logger.revenuecat.warn('Failed to refresh entitlements', { source, error });
      } finally {
        setIsLoading(false);
      }
    },
    [applyCustomerInfo, isConfigured]
  );

  const purchasePackage = useCallback(
    async (rcPackage: PurchasesPackage): Promise<PurchaseResult> => {
      if (!isConfigured) {
        return {
          success: false,
          cancelled: false,
          error: 'Purchases not configured.',
        };
      }

      startPurchaseSync();

      try {
        const purchaseResult = await Purchases.purchasePackage(rcPackage);
        const customerInfo =
          purchaseResult &&
          typeof purchaseResult === 'object' &&
          'customerInfo' in purchaseResult
            ? (purchaseResult as { customerInfo: CustomerInfo }).customerInfo
            : (purchaseResult as CustomerInfo);
        await applyCustomerInfo(customerInfo);
        return { success: true, cancelled: false, error: null };
      } catch (error) {
        const cancelled =
          typeof error === 'object' &&
          error !== null &&
          'userCancelled' in error &&
          Boolean((error as { userCancelled?: boolean }).userCancelled);

        stopPurchaseSync();

        return {
          success: false,
          cancelled,
          error: error instanceof Error ? error.message : 'Purchase failed.',
        };
      }
    },
    [applyCustomerInfo, isConfigured, startPurchaseSync, stopPurchaseSync]
  );

  const restorePurchases = useCallback(async (): Promise<PurchaseResult> => {
    if (!isConfigured) {
      return {
        success: false,
        cancelled: false,
        error: 'Purchases not configured.',
      };
    }

    try {
      const restoredInfo = await Purchases.restorePurchases();
      await applyCustomerInfo(restoredInfo);
      return { success: true, cancelled: false, error: null };
    } catch (error) {
      return {
        success: false,
        cancelled: false,
        error: error instanceof Error ? error.message : 'Restore failed.',
      };
    }
  }, [applyCustomerInfo, isConfigured]);

  const presentPaywall = useCallback(
    async (source = 'paywall'): Promise<PaywallResult> => {
      if (!isConfigured) {
        return { status: 'error', error: 'Purchases not configured.' };
      }

      if (Platform.OS === 'web') {
        return { status: 'error', error: 'Paywall not supported on web.' };
      }

      // Native paywall UI not available - use custom paywall screen instead
      trackEvent('paywall_impression', { source });
      return { status: 'error', error: 'Native paywall UI not available. Use custom paywall.' };
    },
    [isConfigured]
  );

  const presentCustomerCenter = useCallback(
    async (_source = 'settings'): Promise<CustomerCenterResult> => {
      if (!isConfigured) {
        return { status: 'error', error: 'Purchases not configured.' };
      }

      if (Platform.OS === 'web') {
        return { status: 'error', error: 'Customer Center not supported on web.' };
      }

      // Native customer center UI not available
      return { status: 'error', error: 'Customer Center not available.' };
    },
    [isConfigured]
  );

  const markPurchaseSyncDelayed = useCallback(() => {
    setPurchaseSyncStatus('delayed');
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadCache = async () => {
      try {
        const stored = await AsyncStorage.getItem(ENTITLEMENT_CACHE_KEY);
        if (!stored || !isMounted) return;

        const parsed = JSON.parse(stored) as CachedEntitlement;
        if (parsed && typeof parsed.lastVerifiedAt === 'number') {
          setCachedEntitlement(parsed);
          setLastVerifiedAt(parsed.lastVerifiedAt);
          setEntitlementExpiresAt(parsed.expiresAt ?? null);
        }
      } catch (error) {
        logger.revenuecat.warn('Failed to load entitlement cache', error);
      }
    };

    void loadCache();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const configure = async () => {
      if (configuredRef.current) return;
      if (Platform.OS === 'web') {
        setIsLoading(false);
        return;
      }

      const configured = await configureRevenueCat();
      configuredRef.current = configured;
      if (!isMounted) return;
      setIsConfigured(configured);
      if (!configured) {
        setIsLoading(false);
      }
    };

    void configure();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isConfigured) return;
    if (!user?.id) return;

    Purchases.logIn(user.id)
      .then(() => {
        logger.revenuecat.info('Logged in', { userId: user.id });
        return refreshEntitlements('login');
      })
      .catch((error) => {
        logger.revenuecat.warn('Failed to log in', { userId: user.id, error });
      });
  }, [isConfigured, refreshEntitlements, user?.id]);

  useEffect(() => {
    if (!isConfigured) return;
    if (user?.id) return;

    Purchases.logOut()
      .then(() => {
        logger.revenuecat.info('Logged out');
        setEntitlementStatus('unknown');
        setOfferings(null);
        setLastVerifiedAt(null);
        setEntitlementExpiresAt(null);
      })
      .catch((error) => {
        logger.revenuecat.warn('Failed to log out', error);
      });
  }, [isConfigured, user?.id]);

  useEffect(() => {
    if (!isConfigured) return;
    void refreshEntitlements('launch');
  }, [isConfigured, refreshEntitlements]);

  useEffect(() => {
    if (!isConfigured || !profile) return;

    const attributes: Record<string, string> = {
      is_creator: profile.first_world_created_at ? 'true' : 'false',
      owned_worlds_count: String(profile.owned_worlds_count ?? 0),
    };

    if (profile.created_at) {
      attributes.signup_date = profile.created_at;
    }
    if (profile.acquisition_channel) {
      attributes.acquisition_channel = profile.acquisition_channel;
    }
    if (profile.acquisition_campaign) {
      attributes.acquisition_campaign = profile.acquisition_campaign;
    }

    Purchases.setAttributes(attributes).catch((error) => {
      logger.revenuecat.warn('Failed to set subscriber attributes', error);
    });
  }, [isConfigured, profile]);

  useEffect(() => {
    if (!isConfigured) return;

    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        void refreshEntitlements('foreground');
      }
    };

    const subscription = AppState.addEventListener('change', handleAppState);
    return () => {
      subscription.remove();
    };
  }, [isConfigured, refreshEntitlements]);

  useEffect(() => {
    if (purchaseSyncStatus !== 'delayed') return;
    trackEvent('subscription_sync_delayed', { source: 'timer' });
  }, [purchaseSyncStatus]);

  useEffect(() => {
    if (purchaseSyncStatus === 'idle') return;
    if (entitlementStatus !== 'active') return;

    const startedAt = syncStartedAtRef.current ?? Date.now();
    const elapsed = Date.now() - startedAt;
    const delay = Math.max(0, PURCHASE_SYNC_MIN_DISPLAY_MS - elapsed);
    const timer = setTimeout(() => {
      stopPurchaseSync();
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [entitlementStatus, purchaseSyncStatus, stopPurchaseSync]);

  const isEntitled = entitlementStatus === 'active';
  const cachedIsEntitled = cachedEntitlement?.isEntitled ?? false;
  const cachedWithinGrace = cachedEntitlement?.lastVerifiedAt
    ? Date.now() - cachedEntitlement.lastVerifiedAt <= OFFLINE_GRACE_MS
    : false;

  const canAccessPaidFeatures =
    isEntitled || (entitlementStatus === 'unknown' && cachedIsEntitled && cachedWithinGrace);

  const needsConnection =
    entitlementStatus === 'unknown' && !isLoading && (!cachedIsEntitled || !cachedWithinGrace);

  const currentOffering = useMemo(() => getOfferingFromResults(offerings), [offerings]);
  const monthlyPackage = useMemo(
    () => (currentOffering ? findPackageByType(currentOffering.availablePackages, 'MONTHLY') : null),
    [currentOffering]
  );
  const annualPackage = useMemo(
    () => (currentOffering ? findPackageByType(currentOffering.availablePackages, 'ANNUAL') : null),
    [currentOffering]
  );

  const handleRetrySync = useCallback(async () => {
    trackEvent('subscription_sync_retry', { source: 'banner' });
    await refreshEntitlements('retry');
  }, [refreshEntitlements]);

  const value = useMemo(
    () => ({
      isEntitled,
      entitlementStatus,
      entitlementExpiresAt,
      canAccessPaidFeatures,
      needsConnection,
      isLoading,
      lastVerifiedAt,
      offerings,
      currentOffering,
      monthlyPackage,
      annualPackage,
      purchaseSyncStatus,
      refreshEntitlements,
      purchasePackage,
      restorePurchases,
      presentPaywall,
      presentCustomerCenter,
      markPurchaseSyncDelayed,
    }),
    [
      annualPackage,
      canAccessPaidFeatures,
      currentOffering,
      entitlementExpiresAt,
      entitlementStatus,
      isEntitled,
      isLoading,
      lastVerifiedAt,
      markPurchaseSyncDelayed,
      monthlyPackage,
      needsConnection,
      offerings,
      purchasePackage,
      purchaseSyncStatus,
      presentCustomerCenter,
      presentPaywall,
      refreshEntitlements,
      restorePurchases,
    ]
  );

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
      <SubscriptionSyncBanner
        visible={purchaseSyncStatus !== 'idle'}
        status={purchaseSyncStatus === 'delayed' ? 'delayed' : 'syncing'}
        onRetry={handleRetrySync}
      />
    </SubscriptionContext.Provider>
  );
}

export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return ctx;
}
