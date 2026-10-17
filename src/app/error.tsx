"use client";

import { useEffect } from "react";
import { Alert, Button, ButtonLink } from "@/components/ui/primitives";

/** Route-level error boundary for unexpected rendering failures. */
export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[tempo] Unhandled UI error", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <Alert
        tone="error"
        title="Something went wrong on this page"
        action={
          <div className="flex gap-2">
            <Button size="sm" variant="primary" onClick={reset}>Try again</Button>
            <ButtonLink size="sm" href="/">Go home</ButtonLink>
          </div>
        }
      >
        Your saved games are not affected. If this keeps happening, try reloading, or clear this site&apos;s data from Settings.
      </Alert>
    </div>
  );
}
