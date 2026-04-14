/**
 * useInfinitePhotos Hook
 *
 * Loads ALL photos at once for a date range. No pagination.
 */

import { useState, useCallback, useRef } from 'react';

import { logger } from '@/lib/logger';
import {
  loadPhotosWithFiltering,
  type FilteredPhoto,
  type PhotoFilterStats,
} from '@/lib/photo-filter';

/** Pre-selection threshold - auto-select if fewer than this many photos */
export const PRESELECT_THRESHOLD = 50;

export interface UseInfinitePhotosOptions {
  startDate: string;
  endDate: string;
  excludedAlbumIds: string[];
}

export interface UseInfinitePhotosResult {
  photos: FilteredPhoto[];
  loading: boolean;
  error: string | null;
  stats: PhotoFilterStats | null;
  refresh: () => Promise<void>;
  initialized: boolean;
}

export function useInfinitePhotos(
  options: UseInfinitePhotosOptions
): UseInfinitePhotosResult {
  const [photos, setPhotos] = useState<FilteredPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<PhotoFilterStats | null>(null);
  const [initialized, setInitialized] = useState(false);

  const isLoadingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      // Load ALL photos at once - no pagination
      const result = await loadPhotosWithFiltering({
        startDate: options.startDate,
        endDate: options.endDate,
        excludedAlbumIds: options.excludedAlbumIds,
        pageSize: 50000, // Load everything
      });

      setPhotos(result.photos);
      setStats(result.stats);
      setInitialized(true);

      logger.photos.info('Loaded all photos', {
        count: result.photos.length,
        stats: result.stats,
      });
    } catch (err) {
      logger.photos.error('Failed to load photos', err);
      setError(err instanceof Error ? err.message : 'Failed to load photos');
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, [options.startDate, options.endDate, options.excludedAlbumIds]);

  return {
    photos,
    loading,
    error,
    stats,
    refresh,
    initialized,
  };
}
