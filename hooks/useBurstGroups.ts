/**
 * useBurstGroups Hook
 *
 * Manages burst photo groups with expansion state and selection tracking.
 * Supports both iOS (native burstIdentifier) and Android (timestamp clustering).
 */

import { useState, useCallback, useMemo } from 'react';
import type { FilteredPhoto, BurstGroup } from '@/lib/photo-filter';
import { groupBursts, pairLivePhotos } from '@/lib/photo-filter';

export interface UseBurstGroupsResult {
  /** Photos with bursts collapsed (only representative shown) */
  groupedPhotos: FilteredPhoto[];
  /** Map of burst ID to burst group details */
  burstGroups: Map<string, BurstGroup>;
  /** Currently expanded burst ID (null if none) */
  expandedBurstId: string | null;
  /** Expand a burst group to show all photos */
  expandBurst: (burstId: string) => void;
  /** Collapse the currently expanded burst */
  collapseBurst: () => void;
  /** Toggle expansion for a burst */
  toggleBurstExpansion: (burstId: string) => void;
  /** Get photos for display (respects expanded state) */
  getDisplayPhotos: () => FilteredPhoto[];
  /** Check if a photo ID belongs to a burst */
  isPhotoBurstMember: (photoId: string) => boolean;
  /** Get the burst group a photo belongs to */
  getBurstForPhoto: (photoId: string) => BurstGroup | undefined;
  /** Get all photo IDs in a burst */
  getBurstPhotoIds: (burstId: string) => string[];
  /** Get the representative photo for a burst */
  getRepresentativePhoto: (burstId: string) => FilteredPhoto | undefined;
}

/**
 * Hook to manage burst photo groups
 *
 * @param photos - Array of filtered photos to process for bursts
 * @param processLivePhotos - Whether to also pair Live Photos (default: true)
 */
export function useBurstGroups(
  photos: FilteredPhoto[],
  processLivePhotos: boolean = true
): UseBurstGroupsResult {
  const [expandedBurstId, setExpandedBurstId] = useState<string | null>(null);

  // Process photos: pair Live Photos and group bursts
  const { groupedPhotos, burstGroups, photoToBurst } = useMemo(() => {
    // First, pair Live Photos (this modifies the photos in place)
    const processedPhotos = processLivePhotos
      ? pairLivePhotos([...photos])
      : [...photos];

    // Then, group bursts
    const { groupedPhotos, burstGroups } = groupBursts(processedPhotos);

    // Create a lookup map from photo ID to burst ID
    const photoToBurst = new Map<string, string>();
    for (const [burstId, group] of burstGroups) {
      for (const photo of group.photos) {
        photoToBurst.set(photo.id, burstId);
      }
    }

    return { groupedPhotos, burstGroups, photoToBurst };
  }, [photos, processLivePhotos]);

  const expandBurst = useCallback((burstId: string) => {
    setExpandedBurstId(burstId);
  }, []);

  const collapseBurst = useCallback(() => {
    setExpandedBurstId(null);
  }, []);

  const toggleBurstExpansion = useCallback((burstId: string) => {
    setExpandedBurstId((current) => (current === burstId ? null : burstId));
  }, []);

  const getDisplayPhotos = useCallback((): FilteredPhoto[] => {
    if (!expandedBurstId) {
      // No burst expanded - return grouped photos (collapsed view)
      return groupedPhotos;
    }

    // A burst is expanded - need to insert all burst photos in place of representative
    const expandedGroup = burstGroups.get(expandedBurstId);
    if (!expandedGroup) {
      return groupedPhotos;
    }

    const result: FilteredPhoto[] = [];
    for (const photo of groupedPhotos) {
      if (photo.id === expandedGroup.representativePhotoId) {
        // Insert all burst photos in place of representative
        result.push(...expandedGroup.photos);
      } else {
        result.push(photo);
      }
    }

    return result;
  }, [groupedPhotos, burstGroups, expandedBurstId]);

  const isPhotoBurstMember = useCallback(
    (photoId: string): boolean => {
      return photoToBurst.has(photoId);
    },
    [photoToBurst]
  );

  const getBurstForPhoto = useCallback(
    (photoId: string): BurstGroup | undefined => {
      const burstId = photoToBurst.get(photoId);
      return burstId ? burstGroups.get(burstId) : undefined;
    },
    [photoToBurst, burstGroups]
  );

  const getBurstPhotoIds = useCallback(
    (burstId: string): string[] => {
      const group = burstGroups.get(burstId);
      return group ? group.photos.map((p) => p.id) : [];
    },
    [burstGroups]
  );

  const getRepresentativePhoto = useCallback(
    (burstId: string): FilteredPhoto | undefined => {
      const group = burstGroups.get(burstId);
      if (!group) return undefined;
      return group.photos.find((p) => p.id === group.representativePhotoId);
    },
    [burstGroups]
  );

  return {
    groupedPhotos,
    burstGroups,
    expandedBurstId,
    expandBurst,
    collapseBurst,
    toggleBurstExpansion,
    getDisplayPhotos,
    isPhotoBurstMember,
    getBurstForPhoto,
    getBurstPhotoIds,
    getRepresentativePhoto,
  };
}
