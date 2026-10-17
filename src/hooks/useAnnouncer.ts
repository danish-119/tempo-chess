"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Short-lived status message for a polite live region (copy confirmations etc.). */
export function useAnnouncer(timeoutMs = 2500) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const announce = useCallback(
    (msg: string) => {
      setMessage(msg);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setMessage(null), timeoutMs);
    },
    [timeoutMs],
  );
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  return { message, announce };
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
