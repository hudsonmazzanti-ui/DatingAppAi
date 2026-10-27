import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator } from "react-native";
import { api, ApiError } from "../lib/api.ts";
import { restoreSignIn, signIn } from "../lib/google.ts";
import { useSession } from "../lib/session.tsx";
import { Body, Button, ErrorText, Field, Screen, Title } from "../lib/ui.tsx";

export default function Welcome() {
  const session = useSession();
  const [code, setCode] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (session.ready) setCode(session.accessCode);
  }, [session.ready, session.accessCode]);

  useEffect(() => {
    restoreSignIn().then(setSignedIn, () => setSignedIn(false));
  }, []);

  async function start() {
    setBusy(true);
    setError("");
    try {
      await session.saveAccessCode(code.trim());
      await api.checkAccess();
      if (!signedIn) {
        const name = await signIn();
        if (name === null) return;
        setSignedIn(true);
      }
      router.push("/questionnaire");
    } catch (e) {
      setError(e instanceof ApiError && e.status === 401 ? "That access code isn't right." : String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  }

  if (!session.ready) return <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <Screen>
      <Title>Build a profile that gets replies</Title>
      <Body>
        Pick your favourite photos from Google Photos. We'll choose the best ones, put them in the right order and write your
        Tinder bio and Hinge prompts.
      </Body>
      <Body muted>
        Only the photos you pick are read. They're processed to build your profile and deleted from our server within an hour.
        Location data is stripped before anything is analysed.
      </Body>
      <Field
        label="Access code"
        hint="Ask whoever invited you."
        value={code}
        onChangeText={setCode}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
      />
      <ErrorText>{error}</ErrorText>
      <Button title={signedIn ? "Continue" : "Sign in with Google"} onPress={start} busy={busy} disabled={!code.trim()} />
    </Screen>
  );
}
