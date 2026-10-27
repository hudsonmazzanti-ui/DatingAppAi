import type { Questionnaire } from "@datingappai/shared";
import * as SecureStore from "expo-secure-store";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { setAccessCode as setApiAccessCode } from "./api.ts";

const ACCESS_CODE_KEY = "accessCode";

interface Session {
  ready: boolean;
  accessCode: string;
  saveAccessCode: (code: string) => Promise<void>;
  questionnaire: Questionnaire | null;
  setQuestionnaire: (q: Questionnaire) => void;
  jobId: string | null;
  setJobId: (id: string | null) => void;
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  useEffect(() => {
    SecureStore.getItemAsync(ACCESS_CODE_KEY)
      .then((code) => {
        if (code) {
          setApiAccessCode(code);
          setAccessCode(code);
        }
      })
      .finally(() => setReady(true));
  }, []);

  const value = useMemo<Session>(
    () => ({
      ready,
      accessCode,
      saveAccessCode: async (code) => {
        setApiAccessCode(code);
        setAccessCode(code);
        await SecureStore.setItemAsync(ACCESS_CODE_KEY, code);
      },
      questionnaire,
      setQuestionnaire,
      jobId,
      setJobId,
    }),
    [ready, accessCode, questionnaire, jobId],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession must be used inside SessionProvider");
  return session;
}
