import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessionProvider } from "../lib/session.tsx";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerBackButtonDisplayMode: "minimal" }}>
          <Stack.Screen name="index" options={{ title: "Profile Coach" }} />
          <Stack.Screen name="questionnaire" options={{ title: "About you" }} />
          <Stack.Screen name="pick" options={{ title: "Your photos" }} />
          <Stack.Screen name="processing" options={{ title: "Working on it", headerBackVisible: false, gestureEnabled: false }} />
          <Stack.Screen name="results" options={{ title: "Your profile", headerBackVisible: false }} />
        </Stack>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
