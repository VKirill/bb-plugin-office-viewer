import { useEffect, useRef, useState } from "react";
import type { AutosaveStatus } from "./session";

export function useChatAutosave(fingerprint: string, save: () => Promise<void>): AutosaveStatus {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const saveRef = useRef(save);
  saveRef.current = save;
  const seen = useRef<string | null>(null);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (seen.current === null) {
      seen.current = fingerprint;
      return;
    }
    if (seen.current === fingerprint) return;
    seen.current = fingerprint;
    dirty.current = true;
    setStatus("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      dirty.current = false;
      setStatus("saving");
      void saveRef.current().then(
        () => setStatus("saved"),
        () => {
          dirty.current = true;
          setStatus("error");
        },
      );
    }, 700);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [fingerprint]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (dirty.current) void saveRef.current();
    };
  }, []);

  return status;
}
