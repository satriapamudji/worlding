import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export interface PushPermissionState {
  status: Notifications.PermissionStatus;
  granted: boolean;
  canAskAgain: boolean;
}

export async function getPushPermissionState(): Promise<PushPermissionState> {
  if (Platform.OS === 'web') {
    return {
      status: 'undetermined' as Notifications.PermissionStatus,
      granted: false,
      canAskAgain: false,
    };
  }

  const { status, granted, canAskAgain } = await Notifications.getPermissionsAsync();
  return { status, granted, canAskAgain };
}

export async function requestPushPermission(): Promise<PushPermissionState> {
  if (Platform.OS === 'web') {
    return {
      status: 'undetermined' as Notifications.PermissionStatus,
      granted: false,
      canAskAgain: false,
    };
  }

  const current = await Notifications.getPermissionsAsync();
  if (current.granted) {
    return { status: current.status, granted: true, canAskAgain: current.canAskAgain };
  }

  const requested = await Notifications.requestPermissionsAsync();
  return {
    status: requested.status,
    granted: requested.granted,
    canAskAgain: requested.canAskAgain,
  };
}
