/**
 * useUploadQueue Hook
 *
 * React hook for interacting with the upload queue.
 * Provides pending upload state and retry functionality.
 */

import { useState, useEffect, useCallback } from 'react';
import { uploadQueue, type QueuedUpload } from '@/lib/upload-queue';
import { uploadMultipleMedia } from '@/lib/api/media';

export interface UseUploadQueueResult {
  /** All pending uploads */
  pendingUploads: QueuedUpload[];
  /** Pending uploads grouped by world ID */
  pendingByWorld: Map<string, QueuedUpload[]>;
  /** Total pending count */
  pendingCount: number;
  /** Whether there are any pending uploads */
  hasPendingUploads: boolean;
  /** Whether retry is in progress */
  retrying: boolean;
  /** Retry all pending uploads */
  retryPending: () => Promise<void>;
  /** Retry uploads for a specific world */
  retryForWorld: (worldId: string) => Promise<void>;
  /** Clear all pending uploads */
  clearQueue: () => Promise<void>;
  /** Refresh the pending uploads list */
  refresh: () => Promise<void>;
  /** Get pending count for a specific world */
  getPendingCountForWorld: (worldId: string) => number;
}

export function useUploadQueue(): UseUploadQueueResult {
  const [pendingUploads, setPendingUploads] = useState<QueuedUpload[]>([]);
  const [retrying, setRetrying] = useState(false);

  // Load pending uploads
  const refresh = useCallback(async () => {
    const pending = await uploadQueue.getPending();
    setPendingUploads(pending);
  }, []);

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Group by world
  const pendingByWorld = new Map<string, QueuedUpload[]>();
  for (const upload of pendingUploads) {
    const existing = pendingByWorld.get(upload.worldId) || [];
    existing.push(upload);
    pendingByWorld.set(upload.worldId, existing);
  }

  const getPendingCountForWorld = useCallback(
    (worldId: string): number => {
      return pendingByWorld.get(worldId)?.length || 0;
    },
    [pendingByWorld]
  );

  const retryPending = useCallback(async () => {
    if (retrying) return;
    setRetrying(true);

    try {
      const pending = await uploadQueue.getPending();
      const byWorld = new Map<string, QueuedUpload[]>();

      // Group by world for batch uploads
      for (const upload of pending) {
        const existing = byWorld.get(upload.worldId) || [];
        existing.push(upload);
        byWorld.set(upload.worldId, existing);
      }

      // Process each world's uploads
      for (const [worldId, uploads] of byWorld) {
        // Mark all as uploading
        await Promise.all(
          uploads.map((u) => uploadQueue.markUploading(u.id))
        );

        // Convert to upload format
        const files = uploads.map((u) => ({
          uri: u.photoUri,
          type: u.type,
          width: u.width,
          height: u.height,
          duration: u.duration,
          takenAt: u.takenAt,
          livePhotoMovUri: u.livePhotoMovUri,
        }));

        try {
          const result = await uploadMultipleMedia(worldId, files, () => {
            // Progress callback - could update UI here
          });

          // Mark successful uploads as complete (remove from queue)
          const successfulIds = result.successful.map((_, index) => uploads[index].id);
          await uploadQueue.clearCompleted(successfulIds);

          // Mark failed uploads
          for (const failed of result.failed) {
            const upload = uploads.find((u) => u.photoUri === failed.uri);
            if (upload) {
              await uploadQueue.markFailed(upload.id, failed.error);
            }
          }
        } catch (error) {
          // Mark all as failed
          await Promise.all(
            uploads.map((u) =>
              uploadQueue.markFailed(
                u.id,
                error instanceof Error ? error.message : 'Upload failed'
              )
            )
          );
        }
      }
    } finally {
      setRetrying(false);
      await refresh();
    }
  }, [retrying, refresh]);

  const retryForWorld = useCallback(
    async (worldId: string) => {
      if (retrying) return;
      setRetrying(true);

      try {
        const uploads = await uploadQueue.getForWorld(worldId);
        const pending = uploads.filter(
          (u) => u.status === 'pending' || u.status === 'failed'
        );

        if (pending.length === 0) return;

        // Mark all as uploading
        await Promise.all(
          pending.map((u) => uploadQueue.markUploading(u.id))
        );

        // Convert to upload format
        const files = pending.map((u) => ({
          uri: u.photoUri,
          type: u.type,
          width: u.width,
          height: u.height,
          duration: u.duration,
          takenAt: u.takenAt,
          livePhotoMovUri: u.livePhotoMovUri,
        }));

        try {
          const result = await uploadMultipleMedia(worldId, files, () => {});

          // Mark successful uploads as complete
          const successfulIds = result.successful.map((_, index) => pending[index].id);
          await uploadQueue.clearCompleted(successfulIds);

          // Mark failed uploads
          for (const failed of result.failed) {
            const upload = pending.find((u) => u.photoUri === failed.uri);
            if (upload) {
              await uploadQueue.markFailed(upload.id, failed.error);
            }
          }
        } catch (error) {
          // Mark all as failed
          await Promise.all(
            pending.map((u) =>
              uploadQueue.markFailed(
                u.id,
                error instanceof Error ? error.message : 'Upload failed'
              )
            )
          );
        }
      } finally {
        setRetrying(false);
        await refresh();
      }
    },
    [retrying, refresh]
  );

  const clearQueue = useCallback(async () => {
    await uploadQueue.clear();
    await refresh();
  }, [refresh]);

  return {
    pendingUploads,
    pendingByWorld,
    pendingCount: pendingUploads.length,
    hasPendingUploads: pendingUploads.length > 0,
    retrying,
    retryPending,
    retryForWorld,
    clearQueue,
    refresh,
    getPendingCountForWorld,
  };
}
