import type { ExpoConfig } from "expo/config";

// Set these in apps/mobile/.env (see .env.example). The reversed iOS client id
// comes from the iOS OAuth client in Google Cloud Console.
const iosUrlScheme = process.env.GOOGLE_IOS_URL_SCHEME ?? "com.googleusercontent.apps.REPLACE_ME";

const config: ExpoConfig = {
  name: "Profile Coach",
  slug: "datingappai",
  scheme: "datingappai",
  version: "0.1.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.datingappai.app",
    infoPlist: {
      NSPhotoLibraryAddUsageDescription: "Saves your chosen profile photos, in order, so you can upload them to Tinder or Hinge.",
    },
  },
  android: {
    package: "com.datingappai.app",
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
  },
  plugins: [
    "expo-router",
    "expo-web-browser",
    "expo-image",
    "expo-secure-store",
    [
      "expo-media-library",
      {
        savePhotosPermission: "Saves your chosen profile photos, in order, so you can upload them to Tinder or Hinge.",
        isAccessMediaLocationEnabled: false,
      },
    ],
    ["@react-native-google-signin/google-signin", { iosUrlScheme }],
  ],
};

export default config;
