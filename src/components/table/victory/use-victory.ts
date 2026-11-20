"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Whether a finished hand should set off the victory flight on this screen.
 *
 * Only when the viewer won chips in it, and only when this screen saw the
 * hand still running: reconnecting to (or opening) a table whose hand is
 * already over does not replay it. Each hand celebrates at most once.
 */
export function shouldCelebrate({
  handNumber,
  finished,
  myWinnings,
  seenRunning,
  celebrated,
}: {
  handNumber: number;
  finished: boolean;
  myWinnings: number;
  seenRunning: ReadonlySet<number>;
  celebrated: ReadonlySet<number>;
}) {
  return finished && myWinnings > 0 && seenRunning.has(handNumber) && !celebrated.has(handNumber);
}

/**
 * Tracks hands as they arrive and returns the hand number to celebrate, or
 * null, plus a callback for when the animation ends.
 */
export function useVictory(handNumber: number, hand: { finished: boolean } | null, myWinnings: number) {
  const seenRunning = useRef(new Set<number>());
  const celebrated = useRef(new Set<number>());
  const [cue, setCue] = useState<number | null>(null);
  const finished = hand?.finished ?? false;
  const exists = hand !== null;

  useEffect(() => {
    if (!exists) return;
    if (!finished) {
      seenRunning.current.add(handNumber);
      return;
    }
    if (
      shouldCelebrate({
        handNumber,
        finished,
        myWinnings,
        seenRunning: seenRunning.current,
        celebrated: celebrated.current,
      })
    ) {
      celebrated.current.add(handNumber);
      setCue(handNumber);
    }
  }, [exists, finished, handNumber, myWinnings]);

  const end = useCallback(() => setCue(null), []);
  return { cue, end };
}
