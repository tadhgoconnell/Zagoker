import type { Metadata } from "next";
import { Suspense } from "react";
import { LobbyClient } from "@/components/lobby/lobby-client";
import { Container } from "@/components/ui/container";
import { routes } from "@/config/site";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Lobby" };

export default function LobbyPage() {
  return (
    <Container className="py-10 sm:py-14">
      <h1 className="font-display text-4xl font-bold">Lobby</h1>
      <p className="mt-2 mb-8 text-mist">Join a public table, or create your own and invite friends.</p>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-white/5" aria-busy="true" />}>
        <Lobby />
      </Suspense>
    </Container>
  );
}

async function Lobby() {
  const user = await requireUser(routes.lobby);
  return <LobbyClient chips={user.chips} />;
}
