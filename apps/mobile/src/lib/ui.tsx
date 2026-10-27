import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const light = { bg: "#FFFFFF", card: "#F4F4F6", text: "#16161A", muted: "#6B6B76", accent: "#E8456B", border: "#E2E2E8", danger: "#C62828" };
const dark = { bg: "#111114", card: "#1E1E23", text: "#F4F4F6", muted: "#A0A0AB", accent: "#FF6B8B", border: "#2E2E35", danger: "#FF6B6B" };
export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === "dark" ? dark : light;
}

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const c = useColors();
  const body = <View style={styles.body}>{children}</View>;
  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: c.bg }]} edges={["bottom", "left", "right"]}>
      {scroll ? <ScrollView keyboardShouldPersistTaps="handled">{body}</ScrollView> : body}
    </SafeAreaView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={[styles.title, { color: useColors().text }]}>{children}</Text>;
}

export function Body({ children, muted, style }: { children: ReactNode; muted?: boolean; style?: object }) {
  const c = useColors();
  return <Text style={[styles.text, { color: muted ? c.muted : c.text }, style]}>{children}</Text>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  return children ? <Text style={[styles.text, { color: useColors().danger }]}>{children}</Text> : null;
}

export function Button({
  title,
  onPress,
  disabled,
  busy,
  secondary,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  secondary?: boolean;
}) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.button,
        secondary ? { backgroundColor: c.card, borderColor: c.border, borderWidth: 1 } : { backgroundColor: c.accent },
        (disabled || pressed) && { opacity: 0.5 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={secondary ? c.text : "#fff"} />
      ) : (
        <Text style={[styles.buttonText, { color: secondary ? c.text : "#fff" }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Field({ label, hint, ...props }: TextInputProps & { label: string; hint?: string }) {
  const c = useColors();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: c.text }]}>{label}</Text>
      {hint ? <Text style={[styles.hint, { color: c.muted }]}>{hint}</Text> : null}
      <TextInput
        placeholderTextColor={c.muted}
        style={[styles.input, { color: c.text, backgroundColor: c.card, borderColor: c.border }, props.multiline && styles.multiline]}
        {...props}
      />
    </View>
  );
}

export function Card({ children }: { children: ReactNode }) {
  const c = useColors();
  return <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>{children}</View>;
}

export const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { padding: 20, gap: 16 },
  title: { fontSize: 26, fontWeight: "700" },
  text: { fontSize: 16, lineHeight: 22 },
  button: { borderRadius: 12, paddingVertical: 14, paddingHorizontal: 18, alignItems: "center" },
  buttonText: { fontSize: 16, fontWeight: "600" },
  field: { gap: 6 },
  label: { fontSize: 15, fontWeight: "600" },
  hint: { fontSize: 13 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 16 },
  multiline: { minHeight: 80, textAlignVertical: "top" },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
});
