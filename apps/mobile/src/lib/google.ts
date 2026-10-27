import { GoogleSignin, isSuccessResponse } from "@react-native-google-signin/google-signin";

// Lets the backend create a Picker session and download only the photos the user picks.
const PHOTOS_PICKER_SCOPE = "https://www.googleapis.com/auth/photospicker.mediaitems.readonly";

GoogleSignin.configure({
  scopes: [PHOTOS_PICKER_SCOPE],
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
});

export async function signIn(): Promise<string | null> {
  await GoogleSignin.hasPlayServices();
  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) return null;
  // Older sign-ins may predate the Photos scope.
  if (!response.data.scopes.includes(PHOTOS_PICKER_SCOPE)) {
    const added = await GoogleSignin.addScopes({ scopes: [PHOTOS_PICKER_SCOPE] });
    if (!added || !isSuccessResponse(added)) return null;
  }
  return response.data.user.givenName ?? response.data.user.name ?? "";
}

export async function restoreSignIn(): Promise<boolean> {
  if (!GoogleSignin.hasPreviousSignIn()) return false;
  const response = await GoogleSignin.signInSilently();
  return response.type === "success";
}

/** A fresh access token; the library refreshes it when it has expired. */
export async function accessToken(): Promise<string> {
  return (await GoogleSignin.getTokens()).accessToken;
}

export async function signOut(): Promise<void> {
  await GoogleSignin.signOut();
}
