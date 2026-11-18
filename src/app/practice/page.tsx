import type { Metadata } from "next";
import { Suspense } from "react";
import { PracticeClient } from "@/components/practice/practice-client";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Practice",
  description: "Play No-Limit Hold'em against computer opponents, at a difficulty from 0 to 10.",
};

/** Practice against bots. Open to everyone; runs entirely in the browser. */
export default function PracticePage() {
  return (
    <Suspense fallback={<div className="flex-1" aria-busy="true" />}>
      <Practice />
    </Suspense>
  );
}

async function Practice() {
  const user = await getCurrentUser();
  return <PracticeClient me={{ name: user?.username ?? "You", avatar: user?.avatar ?? "spade" }} />;
}
