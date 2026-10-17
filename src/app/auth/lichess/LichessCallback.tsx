"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Alert, ButtonLink, Spinner } from "@/components/ui/primitives";
import { LichessAuthError, completeLichessLogin } from "@/lib/lichess/auth";

export function LichessCallback() {
  const params = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    // The code can be exchanged only once (Strict Mode runs effects twice in dev).
    if (ran.current) return;
    ran.current = true;
    completeLichessLogin(new URLSearchParams(params.toString())).then(
      (next) => router.replace(next),
      (err: unknown) => setError(err instanceof LichessAuthError ? err.message : "Lichess login failed."),
    );
  }, [params, router]);

  if (error) {
    return (
      <Alert tone="error" title="Couldn't connect Lichess" action={<ButtonLink href="/analyze">Back to analysis</ButtonLink>}>
        {error}
      </Alert>
    );
  }
  return <Spinner label="Connecting your Lichess account…" />;
}
