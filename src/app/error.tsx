"use client";

import { RotateCcw } from "lucide-react";
import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { routes } from "@/config/site";

/** Shown when a page fails to render, instead of a blank screen. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Container className="flex flex-1 flex-col items-center justify-center py-24 text-center">
      <p className="text-gold-gradient font-display text-6xl font-bold">Misdeal</p>
      <h1 className="mt-4 font-display text-3xl font-bold">Something went wrong</h1>
      <p className="mt-3 max-w-md text-mist">
        This page could not be loaded. Your chips are safe: nothing changes unless the server confirms it.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button onClick={reset}>
          <RotateCcw className="size-4" /> Try again
        </Button>
        <ButtonLink href={routes.lobby} variant="secondary">
          Go to the lobby
        </ButtonLink>
      </div>
      {error.digest && <p className="mt-6 font-mono text-xs text-slate">Reference: {error.digest}</p>}
    </Container>
  );
}
