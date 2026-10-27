import { Image } from "expo-image";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, useWindowDimensions, View } from "react-native";
import { api, photoSource, type JobState } from "../lib/api.ts";
import { usePoll } from "../lib/poll.ts";
import { useSession } from "../lib/session.tsx";
import { Body, Button, ErrorText, Screen, Title, useColors } from "../lib/ui.tsx";

type Phase =
  | { name: "intro" }
  | { name: "picking"; sessionId: string; pollIntervalMs: number }
  | { name: "downloading"; jobId: string }
  | { name: "choose_me"; jobId: string; photoIds: string[] };

const MAX_REFERENCES = 2;
const GRID_COLUMNS = 3;

export default function Pick() {
  const session = useSession();
  const c = useColors();
  const { width } = useWindowDimensions();
  const [phase, setPhase] = useState<Phase>({ name: "intro" });
  const [detail, setDetail] = useState("");
  const [references, setReferences] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function openPicker() {
    setBusy(true);
    setError("");
    try {
      const picker = await api.createPickerSession();
      setPhase({ name: "picking", sessionId: picker.id, pollIntervalMs: picker.pollIntervalMs });
      // Resolves when the user closes the browser; the poll below notices when they tap Done.
      await WebBrowser.openBrowserAsync(picker.pickerUri);
    } catch (e) {
      setError((e as Error).message);
      setPhase({ name: "intro" });
    } finally {
      setBusy(false);
    }
  }

  usePoll(
    phase.name === "picking"
      ? async () => {
          const { ready } = await api.pickerSession(phase.sessionId);
          if (!ready) return false;
          WebBrowser.dismissBrowser().catch(() => {});
          const { jobId } = await api.createJob(phase.sessionId);
          session.setJobId(jobId);
          setPhase({ name: "downloading", jobId });
          return true;
        }
      : null,
    phase.name === "picking" ? phase.pollIntervalMs : 3000,
  );

  usePoll(
    phase.name === "downloading"
      ? async () => {
          const job: JobState = await api.job(phase.jobId);
          setDetail(job.detail ?? "");
          if (job.status === "failed") {
            setError(job.error ?? "Downloading your photos failed.");
            setPhase({ name: "intro" });
            return true;
          }
          if (job.status !== "awaiting_reference") return false;
          setPhase({ name: "choose_me", jobId: phase.jobId, photoIds: job.photoIds });
          return true;
        }
      : null,
    1500,
  );

  function toggleReference(id: string) {
    setReferences((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id].slice(-MAX_REFERENCES),
    );
  }

  async function start() {
    if (phase.name !== "choose_me" || !session.questionnaire) return;
    setBusy(true);
    setError("");
    try {
      await api.startJob(phase.jobId, references, session.questionnaire);
      router.replace("/processing");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (phase.name === "choose_me") {
    const size = (width - 40 - (GRID_COLUMNS - 1) * 6) / GRID_COLUMNS;
    return (
      <Screen>
        <Title>Which ones are you?</Title>
        <Body muted>
          Tap 1 or 2 clear photos of just you. They help us find you in group shots. ({phase.photoIds.length} photos picked)
        </Body>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {phase.photoIds.map((id) => {
            const selected = references.includes(id);
            return (
              <Pressable
                key={id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={`Photo ${id}`}
                onPress={() => toggleReference(id)}
              >
                <Image
                  source={photoSource(phase.jobId, id)}
                  style={{ width: size, height: size, borderRadius: 8, borderWidth: selected ? 4 : 0, borderColor: c.accent }}
                  contentFit="cover"
                />
                {selected ? (
                  <Text style={{ position: "absolute", top: 6, right: 8, color: "#fff", fontWeight: "800", fontSize: 18 }}>✓</Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
        <ErrorText>{error}</ErrorText>
        <Button title="Build my profile" onPress={start} busy={busy} disabled={references.length === 0} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>Pick 30 to 100 photos</Title>
      <Body>
        Google Photos will open. Select photos of you from the last few years: solo shots, trips, hobbies, nights out. More
        choice means a better profile. We'll do the narrowing down.
      </Body>
      <Body muted>Skip screenshots and photos you'd never post. Tap Done in Google Photos when you're finished.</Body>
      {phase.name === "intro" ? null : (
        <View style={{ alignItems: "center", gap: 8, paddingVertical: 12 }}>
          <ActivityIndicator />
          <Body muted>
            {phase.name === "picking" ? "Waiting for you to finish picking…" : `Fetching your photos… ${detail}`}
          </Body>
        </View>
      )}
      <ErrorText>{error}</ErrorText>
      {phase.name === "downloading" ? null : (
        <Button
          title={phase.name === "picking" ? "Open Google Photos again" : "Open Google Photos"}
          onPress={openPicker}
          busy={busy}
        />
      )}
    </Screen>
  );
}
