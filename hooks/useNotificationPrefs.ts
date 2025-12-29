import { useCallback, useEffect, useState } from 'react';

import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIFICATION_PREFS_KEY = '@worlding/notification_prefs';

export interface NotificationPrefs {
  pushEnabled: boolean;
  newPhotos: boolean;
  worldInvites: boolean;
  throwbacks: boolean;
  emailEnabled: boolean;
  weeklyDigest: boolean;
  productUpdates: boolean;
  prompted: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  pushEnabled: false,
  newPhotos: true,
  worldInvites: true,
  throwbacks: false,
  emailEnabled: false,
  weeklyDigest: false,
  productUpdates: false,
  prompted: false,
};

interface UseNotificationPrefsResult {
  prefs: NotificationPrefs;
  loading: boolean;
  updatePrefs: (updates: Partial<NotificationPrefs>) => void;
  resetPrefs: () => void;
}

export function useNotificationPrefs(): UseNotificationPrefsResult {
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    AsyncStorage.getItem(NOTIFICATION_PREFS_KEY)
      .then((value) => {
        if (!isMounted) return;
        if (!value) {
          setPrefs(DEFAULT_PREFS);
          return;
        }

        try {
          const parsed = JSON.parse(value) as Partial<NotificationPrefs>;
          setPrefs({ ...DEFAULT_PREFS, ...parsed });
        } catch {
          setPrefs(DEFAULT_PREFS);
        }
      })
      .catch(() => {
        if (isMounted) setPrefs(DEFAULT_PREFS);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const updatePrefs = useCallback((updates: Partial<NotificationPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...updates };
      void AsyncStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const resetPrefs = useCallback(() => {
    setPrefs(DEFAULT_PREFS);
    void AsyncStorage.removeItem(NOTIFICATION_PREFS_KEY);
  }, []);

  return { prefs, loading, updatePrefs, resetPrefs };
}

