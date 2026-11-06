"use client";

import { useCallback, useEffect, useState } from "react";
import { type Progress, emptyProgress } from "@/lib/progress";
import { PROGRESS_CHANGED, getProgress, updateProgress } from "@/lib/storage/db";

/** Live view of the local progress document, refreshed whenever any page records something. */
export function useProgress() {
  const [progress, setProgress] = useState<Progress>(emptyProgress);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    setProgress(await getProgress());
    setReady(true);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    window.addEventListener(PROGRESS_CHANGED, refresh);
    return () => window.removeEventListener(PROGRESS_CHANGED, refresh);
  }, [refresh]);

  return { progress, ready };
}

/** Fire-and-forget recorder for pages that only write (practice modes). Never throws. */
export function record(fn: (p: Progress) => Progress): void {
  updateProgress(fn).catch(() => undefined);
}
