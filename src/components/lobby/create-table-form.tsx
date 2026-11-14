"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { apiCall } from "@/lib/game/client";
import { formatChips } from "@/lib/utils";

const blindLevels = [
  [5, 10], [10, 20], [25, 50], [50, 100], [100, 200], [250, 500], [500, 1000],
] as const;
const stackSizes = [20, 50, 100, 200] as const; // in big blinds

const selectClass =
  "h-12 w-full rounded-xl border border-white/10 bg-ink-900/70 px-3 text-base text-cream hover:border-white/20 focus:border-gold-400 focus:outline-none";

export function CreateTableForm({ chips, onCancel }: { chips: number; onCancel: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [level, setLevel] = useState(1);
  const [stackBb, setStackBb] = useState<number>(100);
  const [isPrivate, setIsPrivate] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [smallBlind, bigBlind] = blindLevels[level];
  const buyIn = bigBlind * stackBb;
  const tooExpensive = buyIn > chips;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    const created = await apiCall<{ table: { id: string; room_code: string } }>("/api/tables", {
      name, maxPlayers, smallBlind, bigBlind, buyIn, isPrivate,
    });
    if (!created.ok) {
      setError(created.message);
      setPending(false);
      return;
    }
    const { id, room_code } = created.data.table;
    // Sit the host down straight away. If that fails (for example not enough
    // chips) they still land on the table and see why.
    await apiCall(`/api/tables/${id}/join`, { seat: 0, roomCode: room_code });
    router.refresh(); // the header balance changed
    router.push(`/table/${id}`);
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      {error && <Alert tone="error">{error}</Alert>}
      <Field
        label="Table name"
        name="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        minLength={3}
        maxLength={40}
        placeholder="Friday night poker"
      />
      <div className="grid gap-5 sm:grid-cols-3">
        <label className="block text-sm font-medium">
          <span className="mb-1.5 block">Seats</span>
          <select className={selectClass} value={maxPlayers} onChange={(e) => setMaxPlayers(Number(e.target.value))}>
            {[2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <option key={n} value={n}>{n} players</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          <span className="mb-1.5 block">Blinds</span>
          <select className={selectClass} value={level} onChange={(e) => setLevel(Number(e.target.value))}>
            {blindLevels.map(([sb, bb], i) => (
              <option key={bb} value={i}>{formatChips(sb)} / {formatChips(bb)}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          <span className="mb-1.5 block">Starting stack</span>
          <select className={selectClass} value={stackBb} onChange={(e) => setStackBb(Number(e.target.value))}>
            {stackSizes.map((n) => (
              <option key={n} value={n}>{formatChips(bigBlind * n)} ({n} BB)</option>
            ))}
          </select>
        </label>
      </div>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Who can join</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { value: true, title: "Private", body: "Only people with your invitation link or room code." },
            { value: false, title: "Public", body: "Listed in the lobby. Anyone can sit down." },
          ].map((o) => (
            <label
              key={o.title}
              className={`cursor-pointer rounded-xl border p-4 transition-colors ${
                isPrivate === o.value ? "border-gold-400 bg-gold-500/10" : "border-white/10 hover:border-white/20"
              }`}
            >
              <input
                type="radio"
                name="visibility"
                className="sr-only"
                checked={isPrivate === o.value}
                onChange={() => setIsPrivate(o.value)}
              />
              <span className="block font-semibold">{o.title}</span>
              <span className="mt-1 block text-sm text-mist">{o.body}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {tooExpensive && (
        <Alert tone="error">
          This starting stack costs {formatChips(buyIn)} chips and you have {formatChips(chips)}. Choose a
          smaller stack or lower blinds.
        </Alert>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending || tooExpensive}>
          {pending ? "Creating…" : `Create and sit down (${formatChips(buyIn)})`}
        </Button>
      </div>
    </form>
  );
}
