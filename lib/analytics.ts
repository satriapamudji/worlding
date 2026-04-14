import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

export type PaywallReason =
  | 'create_second_world'
  | 'throwbacks'
  | 'drop_export'
  | 'highlights'
  | 'relive'
  | 'storage_limit'
  | 'restore_purchase'
  | 'unknown';

export type AnalyticsEventName =
  | 'paywall_impression'
  | 'paywall_dismiss'
  | 'paywall_triggered'
  | 'paywall_purchase_start'
  | 'paywall_purchase_success'
  | 'paywall_purchase_fail'
  | 'restore_success'
  | 'restore_fail'
  | 'world_create_attempt'
  | 'world_create_success'
  | 'first_world_completed'
  | 'subscription_sync_delayed'
  | 'subscription_sync_retry'
  | 'subscription_verify_required'
  | 'entitlement_refresh';

type AnalyticsProperties = Record<string, unknown>;

export async function trackEvent(
  eventName: AnalyticsEventName,
  properties: AnalyticsProperties = {}
): Promise<void> {
  try {
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id ?? null;
    if (!userId) {
      return;
    }

    const { error } = await supabase
      .from('analytics_events')
      .insert({
        user_id: userId,
        event_name: eventName,
        properties,
      });

    if (error) {
      logger.analytics.warn('Failed to track event', { event: eventName, error: error.message });
    }
  } catch (error) {
    logger.analytics.warn('Failed to track event', { event: eventName, error });
  }
}
