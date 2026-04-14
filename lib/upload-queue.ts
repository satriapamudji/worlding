/**
 * Upload Queue
 *
 * Persistent upload queue using AsyncStorage.
 * Tracks failed uploads for retry on next app open.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { logger } from '@/lib/logger';

const STORAGE_KEY = '@worlding/upload_queue';

export interface QueuedUpload {
  /** Unique ID for this upload */
  id: string;
  /** World to upload to */
  worldId: string;
  /** Local photo URI */
  photoUri: string;
  /** Media type */
  type: 'image' | 'video';
  /** Photo dimensions */
  width?: number;
  height?: number;
  /** Video duration in seconds */
  duration?: number;
  /** When the photo was taken */
  takenAt?: string;
  /** Number of upload attempts */
  attempts: number;
  /** Timestamp of last attempt */
  lastAttemptAt?: number;
  /** Current status */
  status: 'pending' | 'uploading' | 'failed';
  /** Error message if failed */
  error?: string;
  /** For Live Photos: the paired MOV URI */
  livePhotoMovUri?: string;
}

/**
 * Upload Queue Manager
 *
 * Provides methods to add, remove, and manage queued uploads.
 * Persists to AsyncStorage for survival across app restarts.
 */
class UploadQueueManager {
  private queue: QueuedUpload[] = [];
  private initialized = false;

  /**
   * Initialize the queue from storage
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
        // Reset any uploads that were 'uploading' (app crashed mid-upload)
        this.queue.forEach((upload) => {
          if (upload.status === 'uploading') {
            upload.status = 'pending';
          }
        });
        await this.persist();
      }
      this.initialized = true;
      logger.upload.info('Queue initialized', { count: this.queue.length });
    } catch (error) {
      logger.upload.error('Failed to initialize upload queue', error);
      this.queue = [];
      this.initialized = true;
    }
  }

  /**
   * Persist queue to storage
   */
  private async persist(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      logger.upload.error('Failed to persist upload queue', error);
    }
  }

  /**
   * Add uploads to the queue
   */
  async add(uploads: Omit<QueuedUpload, 'id' | 'attempts' | 'status'>[]): Promise<void> {
    await this.initialize();

    const newUploads: QueuedUpload[] = uploads.map((upload) => ({
      ...upload,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      attempts: 0,
      status: 'pending',
    }));

    this.queue.push(...newUploads);
    await this.persist();
  }

  /**
   * Remove an upload from the queue
   */
  async remove(id: string): Promise<void> {
    await this.initialize();
    this.queue = this.queue.filter((u) => u.id !== id);
    await this.persist();
  }

  /**
   * Remove multiple uploads
   */
  async removeMany(ids: string[]): Promise<void> {
    await this.initialize();
    const idSet = new Set(ids);
    this.queue = this.queue.filter((u) => !idSet.has(u.id));
    await this.persist();
  }

  /**
   * Get all queued uploads
   */
  async getAll(): Promise<QueuedUpload[]> {
    await this.initialize();
    return [...this.queue];
  }

  /**
   * Get pending uploads (ready to retry)
   */
  async getPending(): Promise<QueuedUpload[]> {
    await this.initialize();
    return this.queue.filter((u) => u.status === 'pending' || u.status === 'failed');
  }

  /**
   * Get uploads for a specific world
   */
  async getForWorld(worldId: string): Promise<QueuedUpload[]> {
    await this.initialize();
    return this.queue.filter((u) => u.worldId === worldId);
  }

  /**
   * Get pending count by world
   */
  async getPendingCountByWorld(): Promise<Map<string, number>> {
    await this.initialize();
    const counts = new Map<string, number>();

    for (const upload of this.queue) {
      if (upload.status === 'pending' || upload.status === 'failed') {
        const current = counts.get(upload.worldId) || 0;
        counts.set(upload.worldId, current + 1);
      }
    }

    return counts;
  }

  /**
   * Mark an upload as uploading
   */
  async markUploading(id: string): Promise<void> {
    await this.initialize();
    const upload = this.queue.find((u) => u.id === id);
    if (upload) {
      upload.status = 'uploading';
      upload.lastAttemptAt = Date.now();
      upload.attempts += 1;
      await this.persist();
    }
  }

  /**
   * Mark an upload as failed
   */
  async markFailed(id: string, error: string): Promise<void> {
    await this.initialize();
    const upload = this.queue.find((u) => u.id === id);
    if (upload) {
      upload.status = 'failed';
      upload.error = error;
      await this.persist();
    }
  }

  /**
   * Clear the entire queue
   */
  async clear(): Promise<void> {
    this.queue = [];
    await this.persist();
  }

  /**
   * Clear completed uploads (remove successful ones)
   * This is called after successful uploads
   */
  async clearCompleted(ids: string[]): Promise<void> {
    await this.removeMany(ids);
  }

  /**
   * Get total pending count
   */
  async getTotalPendingCount(): Promise<number> {
    await this.initialize();
    return this.queue.filter(
      (u) => u.status === 'pending' || u.status === 'failed'
    ).length;
  }

  /**
   * Check if there are any pending uploads
   */
  async hasPendingUploads(): Promise<boolean> {
    const count = await this.getTotalPendingCount();
    return count > 0;
  }
}

// Singleton instance
export const uploadQueue = new UploadQueueManager();
