import { Questionnaire } from "@datingappai/shared";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useSession } from "../lib/session.tsx";
import { Body, Button, ErrorText, Field, Screen, styles, useColors } from "../lib/ui.tsx";

const TONES = [
  { value: "funny", label: "Funny" },
  { value: "warm", label: "Warm" },
  { value: "direct", label: "Direct" },
] as const;

const PLATFORMS = [
  { value: "tinder", label: "Tinder" },
  { value: "hinge", label: "Hinge" },
] as const;

const splitList = (text: string, separator: RegExp) =>
  text
    .split(separator)
    .map((s) => s.trim())
    .filter(Boolean);

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={{
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: selected ? c.accent : c.border,
        backgroundColor: selected ? c.accent : c.card,
      }}
    >
      <Text style={{ color: selected ? "#fff" : c.text, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

export default function QuestionnaireScreen() {
  const session = useSession();
  const previous = session.questionnaire;
  const [firstName, setFirstName] = useState(previous?.firstName ?? "");
  const [age, setAge] = useState(previous ? String(previous.age) : "");
  const [job, setJob] = useState(previous?.job ?? "");
  const [interests, setInterests] = useState(previous?.interests.join(", ") ?? "");
  const [lookingFor, setLookingFor] = useState(previous?.lookingFor ?? "");
  const [funFacts, setFunFacts] = useState(previous?.funFacts.join("\n") ?? "");
  const [tone, setTone] = useState<Questionnaire["tone"]>(previous?.tone ?? "warm");
  const [platforms, setPlatforms] = useState<Questionnaire["platforms"]>(previous?.platforms ?? ["tinder", "hinge"]);
  const [error, setError] = useState("");

  function next() {
    const parsed = Questionnaire.safeParse({
      firstName: firstName.trim(),
      age: Number(age),
      job: job.trim(),
      interests: splitList(interests, /,/),
      lookingFor: lookingFor.trim(),
      tone,
      funFacts: splitList(funFacts, /\n/),
      platforms,
    });
    if (!parsed.success) {
      const field = parsed.error.issues[0]?.path[0];
      setError(
        field === "age"
          ? "Enter your age (18 or over)."
          : field === "platforms"
            ? "Choose at least one app."
            : `Check "${String(field)}".`,
      );
      return;
    }
    session.setQuestionnaire(parsed.data);
    router.push("/pick");
  }

  return (
    <Screen>
      <Body muted>The more specific you are, the less generic your profile sounds. This takes about two minutes.</Body>
      <Field label="First name" value={firstName} onChangeText={setFirstName} textContentType="givenName" />
      <Field label="Age" value={age} onChangeText={setAge} keyboardType="number-pad" maxLength={2} />
      <Field label="What you do" placeholder="e.g. ER nurse, studying architecture" value={job} onChangeText={setJob} />
      <Field
        label="Things you're into"
        hint="Separate with commas. Be specific: 'bouldering' beats 'sports'."
        placeholder="bouldering, making ramen, Premier League"
        value={interests}
        onChangeText={setInterests}
      />
      <Field
        label="What you're looking for"
        placeholder="Something serious, but fun along the way"
        value={lookingFor}
        onChangeText={setLookingFor}
      />
      <Field
        label="Fun facts or stories"
        hint="One per line. Odd skills, a great trip, a strong opinion."
        placeholder={"I've been to 31 countries\nI can't whistle"}
        value={funFacts}
        onChangeText={setFunFacts}
        multiline
      />
      <View style={{ gap: 8 }}>
        <Body>Tone</Body>
        <View style={styles.row}>
          {TONES.map((t) => (
            <Chip key={t.value} label={t.label} selected={tone === t.value} onPress={() => setTone(t.value)} />
          ))}
        </View>
      </View>
      <View style={{ gap: 8 }}>
        <Body>Apps</Body>
        <View style={styles.row}>
          {PLATFORMS.map((p) => (
            <Chip
              key={p.value}
              label={p.label}
              selected={platforms.includes(p.value)}
              onPress={() =>
                setPlatforms((current) =>
                  current.includes(p.value) ? current.filter((x) => x !== p.value) : [...current, p.value],
                )
              }
            />
          ))}
        </View>
      </View>
      <ErrorText>{error}</ErrorText>
      <Button title="Next: pick photos" onPress={next} disabled={!firstName.trim() || !age} />
    </Screen>
  );
}
