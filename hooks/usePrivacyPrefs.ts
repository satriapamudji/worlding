import { useCallback, useEffect, useState } from 'react';

import AsyncStorage from '@react-native-async-storage/async-storage';

const PRIVACY_PREFS_KEY = '@worlding/privacy_prefs';

export interface ExcludedAlbum {
  id: string;
  title: string;
}

export interface PrivacyPrefs {
  autoSync: boolean;
  uploadOriginal: boolean;
  useCellular: boolean;
  showActivity: boolean;
  excludedAlbums: ExcludedAlbum[];
}

const DEFAULT_PREFS: PrivacyPrefs = {
  autoSync: true,
  uploadOriginal: false,
  useCellular: false,
  showActivity: true,
  excludedAlbums: [],
};

interface UsePrivacyPrefsResult {
  prefs: PrivacyPrefs;
  loading: boolean;
  updatePrefs: (updates: Partial<PrivacyPrefs>) => void;
  resetPrefs: () => void;
}

function normalizeExcludedAlbums(
  rawAlbums: unknown,
  rawIds?: unknown,
): ExcludedAlbum[] {
  const byId = new Map<string, ExcludedAlbum>();

  if (Array.isArray(rawAlbums)) {
    rawAlbums.forEach((album) => {
      if (!album || typeof album !== 'object') return;
      const record = album as { id?: unknown; title?: unknown };
      const id = typeof record.id === 'string' ? record.id : '';
      if (!id) return;
      const title = typeof record.title === 'string' ? record.title : 'Unknown album';
      byId.set(id, { id, title });
    });
  } else if (Array.isArray(rawIds)) {
    rawIds.forEach((id) => {
      if (typeof id !== 'string' || !id) return;
      byId.set(id, { id, title: 'Unknown album' });
    });
  }

  return Array.from(byId.values());
}

function mergePrefs(raw: Partial<PrivacyPrefs> | null): PrivacyPrefs {
  if (!raw) return DEFAULT_PREFS;
  const candidate = raw as Partial<PrivacyPrefs> & { excludedAlbumIds?: unknown };
  const excludedAlbums = normalizeExcludedAlbums(
    candidate.excludedAlbums,
    candidate.excludedAlbumIds,
  );
  return {
    autoSync: candidate.autoSync ?? DEFAULT_PREFS.autoSync,
    uploadOriginal: candidate.uploadOriginal ?? DEFAULT_PREFS.uploadOriginal,
    useCellular: candidate.useCellular ?? DEFAULT_PREFS.useCellular,
    showActivity: candidate.showActivity ?? DEFAULT_PREFS.showActivity,
    excludedAlbums,
  };
}

export function usePrivacyPrefs(): UsePrivacyPrefsResult {
  const [prefs, setPrefs] = useState<PrivacyPrefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    AsyncStorage.getItem(PRIVACY_PREFS_KEY)
      .then((value) => {
        if (!isMounted) return;
        if (!value) {
          setPrefs(DEFAULT_PREFS);
          return;
        }

        try {
          const parsed = JSON.parse(value) as Partial<PrivacyPrefs>;
          setPrefs(mergePrefs(parsed));
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

  const updatePrefs = useCallback((updates: Partial<PrivacyPrefs>) => {
    setPrefs((prev) => {
      const next = mergePrefs({ ...prev, ...updates });
      void AsyncStorage.setItem(PRIVACY_PREFS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const resetPrefs = useCallback(() => {
    setPrefs(DEFAULT_PREFS);
    void AsyncStorage.removeItem(PRIVACY_PREFS_KEY);
  }, []);

  return { prefs, loading, updatePrefs, resetPrefs };
}

export default usePrivacyPrefs;
