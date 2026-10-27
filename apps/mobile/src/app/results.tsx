import { HINGE, TINDER, type GeneratedProfiles } from "@datingappai/shared";
import * as Clipboard from "expo-clipboard";
import { File, Paths } from "expo-file-system";
import { Image } from "expo-image";
import * as MediaLibrary from "expo-media-library";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { api, photoSource } from "../lib/api.ts";
import { useSession } from "../lib/session.tsx";
import { Body, Button, Card, ErrorText, Screen, styles, useColors } from "../lib/ui.tsx";

type Platform = "tinder" | "hinge";
type Picks = { photo_id: string; reason: string; caption?: string }[];

const REWRITE_OPTIONS = ["Funnier", "Shorter", "More specific", "Less try-hard"];

function PhotoStrip({ jobId, picks }: { jobId: string; picks: Picks }) {
  const c = useColors();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
      {picks.map((p, i) => (
        <View key={p.photo_id} style={{ width: 150, gap: 6 }}>
          <Image source={photoSource(jobId, p.photo_id)} style={{ width: 150, height: 200, borderRadius: 10 }} contentFit="cover" />
          <Text style={{ color: c.text, fontWeight: "700" }}>{i + 1}</Text>
          {p.caption ? <Text style={{ color: c.text, fontStyle: "italic" }}>"{p.caption}"</Text> : null}
          <Text style={{ color: c.muted, fontSize: 13 }}>{p.reason}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

function CopyBlock({
  label,
  text,
  limit,
  alternatives = [],
  onRewrite,
}: {
  label: string;
  text: string;
  limit: number;
  alternatives?: string[];
  onRewrite?: (instruction: string) => Promise<void>;
}) {
  const c = useColors();
  const [current, setCurrent] = useState(text);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => setCurrent(text), [text]);

  async function rewrite(instruction: string) {
    if (!onRewrite) return;
    setBusy(true);
    try {
      await onRewrite(instruction);
    } catch (e) {
      Alert.alert("Couldn't rewrite that", (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Text style={{ color: c.muted, fontWeight: "600" }}>{label}</Text>
      <Text selectable style={{ color: c.text, fontSize: 16, lineHeight: 22 }}>
        {current}
      </Text>
      <Text style={{ color: current.length > limit ? c.danger : c.muted, fontSize: 12 }}>
        {current.length}/{limit}
      </Text>
      <View style={styles.row}>
        <Button
          secondary
          title={copied ? "Copied" : "Copy"}
          onPress={async () => {
            await Clipboard.setStringAsync(current);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        />
        {alternatives.map((alt, i) => (
          <Button key={i} secondary title={`Option ${i + 2}`} onPress={() => setCurrent(alt)} />
        ))}
      </View>
      {onRewrite ? (
        <View style={styles.row}>
          {busy ? (
            <ActivityIndicator />
          ) : (
            REWRITE_OPTIONS.map((o) => (
              <Pressable key={o} onPress={() => rewrite(o)} accessibilityRole="button">
                <Text style={{ color: c.accent, fontWeight: "600", paddingVertical: 4 }}>{o}</Text>
              </Pressable>
            ))
          )}
        </View>
      ) : null}
    </Card>
  );
}

async function savePhotosInOrder(jobId: string, platform: Platform, picks: Picks) {
  const permission = await MediaLibrary.requestPermissionsAsync(true);
  if (!permission.granted) throw new Error("Allow photo access in Settings to save your photos.");
  // Saved one at a time so they land in the camera roll in profile order.
  for (const [i, p] of picks.entries()) {
    const source = photoSource(jobId, p.photo_id, "full");
    const file = await File.downloadFileAsync(source.uri, new File(Paths.cache, `${platform}-${i + 1}.jpg`), {
      headers: source.headers,
      idempotent: true,
    });
    await MediaLibrary.Asset.create(file.uri);
    file.delete();
  }
}

export default function Results() {
  const { jobId } = useSession();
  const c = useColors();
  const [profiles, setProfiles] = useState<GeneratedProfiles | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [platform, setPlatform] = useState<Platform>("tinder");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!jobId) return;
    api.job(jobId).then(
      (job) => {
        setProfiles(job.profiles);
        setWarnings(job.warnings);
        if (!job.profiles?.tinder) setPlatform("hinge");
      },
      (e) => setError((e as Error).message),
    );
  }, [jobId]);

  if (!jobId || error) {
    return (
      <Screen>
        <ErrorText>{error || "No profile yet."}</ErrorText>
        <Button title="Start over" onPress={() => router.replace("/")} />
      </Screen>
    );
  }
  if (!profiles) return <ActivityIndicator style={{ flex: 1 }} />;

  const { tinder, hinge } = profiles;
  const picks: Picks = platform === "tinder" ? (tinder?.photos ?? []) : (hinge?.photos ?? []);

  async function save() {
    setSaving(true);
    try {
      await savePhotosInOrder(jobId!, platform, picks);
      Alert.alert("Saved", `Your ${picks.length} photos are the newest in your camera roll, in order. Upload them 1 to ${picks.length}.`);
    } catch (e) {
      Alert.alert("Couldn't save photos", (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <View style={[styles.row, { justifyContent: "center" }]}>
        {(["tinder", "hinge"] as const)
          .filter((p) => profiles[p])
          .map((p) => (
            <Pressable
              key={p}
              onPress={() => setPlatform(p)}
              accessibilityRole="tab"
              accessibilityState={{ selected: platform === p }}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 22,
                borderRadius: 20,
                backgroundColor: platform === p ? c.accent : c.card,
              }}
            >
              <Text style={{ color: platform === p ? "#fff" : c.text, fontWeight: "700" }}>{p === "tinder" ? "Tinder" : "Hinge"}</Text>
            </Pressable>
          ))}
      </View>

      <PhotoStrip jobId={jobId} picks={picks} />
      <Button title={`Save these ${picks.length} photos in order`} onPress={save} busy={saving} />

      {platform === "tinder" && tinder ? (
        <>
          <CopyBlock
            label="Bio"
            text={tinder.bio}
            limit={TINDER.bioMaxChars}
            alternatives={tinder.bio_alternatives}
            onRewrite={async (instruction) => {
              const { text } = await api.rewrite(jobId, { field: "tinder_bio", instruction });
              setProfiles({ ...profiles, tinder: { ...tinder, bio: text } });
            }}
          />
          {tinder.job_title ? <CopyBlock label="Job title" text={tinder.job_title} limit={TINDER.jobTitleMaxChars} /> : null}
          <Card>
            <Text style={{ color: c.muted, fontWeight: "600" }}>Interests</Text>
            <Body>{tinder.interests.join(" · ")}</Body>
            {tinder.anthem ? <Body muted>Anthem idea: {tinder.anthem}</Body> : null}
          </Card>
        </>
      ) : null}

      {platform === "hinge" && hinge
        ? hinge.prompts.map((p, index) => (
            <CopyBlock
              key={p.prompt}
              label={p.prompt}
              text={p.answer}
              limit={HINGE.promptAnswerMaxChars}
              alternatives={p.alternatives}
              onRewrite={async (instruction) => {
                const { text } = await api.rewrite(jobId, { field: "hinge_answer", index, instruction });
                const prompts = hinge.prompts.map((q, i) => (i === index ? { ...q, answer: text } : q));
                setProfiles({ ...profiles, hinge: { ...hinge, prompts } });
              }}
            />
          ))
        : null}

      {profiles.tips.length > 0 || warnings.length > 0 ? (
        <Card>
          <Text style={{ color: c.muted, fontWeight: "600" }}>Tips</Text>
          {[...profiles.tips, ...warnings].map((t) => (
            <Body key={t}>• {t}</Body>
          ))}
        </Card>
      ) : null}

      <Button
        secondary
        title="Start over"
        onPress={() => {
          api.deleteJob(jobId).catch(() => {});
          router.replace("/");
        }}
      />
    </Screen>
  );
}
