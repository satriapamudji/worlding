import { Stack } from 'expo-router';
import { Colors } from '@/constants/theme';

export default function WorldLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <Stack.Screen name="[id]" />
      <Stack.Screen
        name="media"
        options={{
          presentation: 'transparentModal',
          animation: 'fade',
          headerShown: false,
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="relive"
        options={{
          presentation: 'fullScreenModal',
          animation: 'fade',
        }}
      />
    </Stack>
  );
}
