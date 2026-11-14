"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { apiCall } from "@/lib/game/client";
import { formatChips } from "@/lib/utils";

export function JoinCard({ tableId, roomCode, buyIn, full }: { tableId: string; roomCode: string; buyIn: number; full: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = async () => {
    setPending(true);
    setError(null);
    const res = await apiCall(`/api/tables/${tableId}/join`, { roomCode });
    if (res.ok) {
      router.refresh(); // the header balance changed
      router.push(`/table/${tableId}`);
    } else {
      setError(res.message);
      setPending(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && <Alert tone="error">{error}</Alert>}
      <Button size="lg" className="w-full" disabled={pending || full} onClick={join}>
        {full ? "Table is full" : pending ? "Joining…" : `Take a seat (${formatChips(buyIn)} chips)`}
      </Button>
    </div>
  );
}
