/**
 * Lightweight Logger with Namespaces
 *
 * Provides structured logging with consistent formatting across the app.
 * All log levels are visible in all environments.
 *
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.auth.info('User signed in', { userId: '123' });
 *   logger.api.error('Request failed', { status: 500 });
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogData = unknown;

interface NamespacedLogger {
  debug: (message: string, data?: LogData) => void;
  info: (message: string, data?: LogData) => void;
  warn: (message: string, data?: LogData) => void;
  error: (message: string, data?: LogData) => void;
}

const formatData = (data: LogData): string => {
  if (data === undefined || data === null) {
    return '';
  }

  if (data instanceof Error) {
    return data.stack || data.message;
  }

  if (typeof data === 'string' || typeof data === 'number') {
    return String(data);
  }

  try {
    return JSON.stringify(data, null, __DEV__ ? 2 : 0);
  } catch {
    return '[Unable to stringify]';
  }
};

const log = (level: LogLevel, namespace: string, message: string, data?: LogData): void => {
  const timestamp = new Date().toISOString().slice(11, 23);
  const prefix = `[${namespace}]`;
  const formattedData = formatData(data);
  const fullMessage = formattedData ? `${prefix} ${message}` : `${prefix} ${message}`;

  switch (level) {
    case 'debug':
      if (formattedData) {
        console.log(`${timestamp} ${fullMessage}`, formattedData);
      } else {
        console.log(`${timestamp} ${fullMessage}`);
      }
      break;
    case 'info':
      if (formattedData) {
        console.log(`${timestamp} ${fullMessage}`, formattedData);
      } else {
        console.log(`${timestamp} ${fullMessage}`);
      }
      break;
    case 'warn':
      if (formattedData) {
        console.warn(`${timestamp} ${fullMessage}`, formattedData);
      } else {
        console.warn(`${timestamp} ${fullMessage}`);
      }
      break;
    case 'error':
      if (formattedData) {
        console.error(`${timestamp} ${fullMessage}`, formattedData);
      } else {
        console.error(`${timestamp} ${fullMessage}`);
      }
      break;
  }
};

const createNamespacedLogger = (namespace: string): NamespacedLogger => ({
  debug: (message: string, data?: LogData) => log('debug', namespace, message, data),
  info: (message: string, data?: LogData) => log('info', namespace, message, data),
  warn: (message: string, data?: LogData) => log('warn', namespace, message, data),
  error: (message: string, data?: LogData) => log('error', namespace, message, data),
});

/**
 * Logger with pre-defined namespaces for different parts of the app.
 *
 * Namespaces:
 * - auth: Authentication and profile operations
 * - api: General API calls and Supabase operations
 * - revenuecat: RevenueCat and subscription operations
 * - media: Media upload, download, and processing
 * - photos: Photo library and filtering
 * - upload: Upload queue operations
 * - world: World CRUD operations
 * - analytics: Analytics event tracking
 * - app: General app lifecycle and navigation
 */
export const logger = {
  auth: createNamespacedLogger('Auth'),
  api: createNamespacedLogger('API'),
  revenuecat: createNamespacedLogger('RevenueCat'),
  media: createNamespacedLogger('Media'),
  photos: createNamespacedLogger('Photos'),
  upload: createNamespacedLogger('Upload'),
  world: createNamespacedLogger('World'),
  analytics: createNamespacedLogger('Analytics'),
  app: createNamespacedLogger('App'),
};

/**
 * Create a custom namespaced logger for one-off use cases.
 */
export const createLogger = createNamespacedLogger;
