import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { api } from "../lib/api.ts";
import { usePoll } from "../lib/poll.ts";
import { useSession } from "../lib/session.tsx";
import { Body, Button, ErrorText, Screen, Title } from "../lib/ui.tsx";

const STEPS: Record<string, string> = {
  scoring: "Looking at every photo",
  writing: "Choosing your lineup and writing your profile",
  done: "Done",
};

export default function Processing() {
  const { jobId } = useSession();
  const [status, setStatus] = useState("scoring");
  const [detail, setDetail] = useState("");
  const [error, setError] = useState("");

  usePoll(
    jobId && !error
      ? async () => {
          const job = await api.job(jobId);
          setStatus(job.status);
          setDetail(job.detail ?? "");
          if (job.status === "failed") {
            setError(job.error ?? "Something went wrong.");
            return true;
          }
          if (job.status === "done") {
            router.replace("/results");
            return true;
          }
          return false;
        }
      : null,
    2000,
  );

  return (
    <Screen scroll={false}>
      <Title>{error ? "That didn't work" : STEPS[status] ?? "Working…"}</Title>
      {error ? (
        <>
          <ErrorText>{error}</ErrorText>
          <Button title="Pick photos again" onPress={() => router.replace("/pick")} />
        </>
      ) : (
        <View style={{ alignItems: "center", gap: 12, paddingVertical: 24 }}>
          <ActivityIndicator size="large" />
          <Body muted>{detail || "This usually takes about a minute."}</Body>
        </View>
      )}
    </Screen>
  );
}
