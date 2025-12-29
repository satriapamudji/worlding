import { useEffect, useState, useCallback } from 'react';

import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_COMPLETE_KEY = '@worlding/onboarding_complete';

interface UseOnboardingResult {
  hasCompleted: boolean | null;
  loading: boolean;
  markComplete: () => Promise<void>;
}

export function useOnboarding(): UseOnboardingResult {
  const [hasCompleted, setHasCompleted] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY)
      .then((value) => {
        setHasCompleted(value === 'true');
      })
      .catch(() => {
        setHasCompleted(false);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const markComplete = useCallback(async () => {
    await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
    setHasCompleted(true);
  }, []);

  return { hasCompleted, loading, markComplete };
}
