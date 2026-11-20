"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { VictoryOverlay } from "./victory-overlay";

/** Design page: play the victory flight over an empty felt. */
export function VictoryPreview() {
  const [run, setRun] = useState<number | null>(null);
  return (
    <div>
      <Button onClick={() => setRun((n) => (n ?? 0) + 1)} data-play-victory>
        Play victory
      </Button>
      <div className="mx-auto mt-6 w-full max-w-3xl px-10 py-8">
        <div className="relative w-full portrait:aspect-[4/5] landscape:aspect-[2/1]">
          <div className="absolute inset-0 rounded-[50%] border border-ink-500 bg-ink-800" />
          <div className="absolute inset-[4%] rounded-[50%] bg-felt-700" />
          {run !== null && <VictoryOverlay key={run} seed={run} onDone={() => setRun(null)} />}
        </div>
      </div>
    </div>
  );
}
