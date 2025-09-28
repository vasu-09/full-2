// app/_layout.tsx
import { useColorScheme } from '@/hooks/useColorScheme';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  if (!loaded) return null;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="screens/LoginScreen" options={{ headerShown: false }} />
        <Stack.Screen name="screens/OtpScreen" options={{ headerShown: false }} />
        <Stack.Screen name="screens/CameraScreen" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="screens/NewListScreen" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="screens/ViewListScreen" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="screens/PreviewScreen" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="screens/MocScreen" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="screens/ListsScreen" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="screens/LinkListScreen" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="screens/SelectedPreview" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
