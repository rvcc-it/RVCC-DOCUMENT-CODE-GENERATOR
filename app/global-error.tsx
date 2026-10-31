"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { Sentry.captureException(error); }, [error]);
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui", padding: 40 }}>
        <h2>Something went wrong</h2>
        <p>The error has been reported. Please try again.</p>
        <button onClick={reset}>Try again</button>
      </body>
    </html>
  );
}
