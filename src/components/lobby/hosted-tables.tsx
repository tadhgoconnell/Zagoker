"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Panel } from "@/components/ui/panel";
import { apiCall } from "@/lib/game/client";
import type { HostedTable } from "@/lib/game/types";
import { formatChips } from "@/lib/utils";

/**
 * The tables the viewer hosts, public and private: open one, or delete it.
 * Deleting cashes everyone out (a hand in progress is cancelled and every bet
 * returned) and the table disappears for good.
 */
export function HostedTables({ tables, onChange }: { tables: HostedTable[]; onChange: () => void }) {
  const [dialog, confirm] = useConfirm();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (tables.length === 0) return null;

  const remove = async (t: HostedTable) => {
    const ok = await confirm({
      title: `Delete “${t.name}”?`,
      body:
        t.seated > 0
          ? "Everyone at the table is cashed out: their chips go back to their balance, and a hand in progress is cancelled with every bet returned. The table disappears for good."
          : "The table disappears for good.",
      confirmLabel: "Delete table",
      danger: true,
    });
    if (!ok) return;
    setBusy(t.id);
    setError(null);
    const res = await apiCall(`/api/tables/${t.id}/close`, {});
    setBusy(null);
    if (!res.ok && res.code !== "table_not_found") setError(res.message);
    onChange();
  };

  return (
    <section aria-labelledby="hosted-tables">
      {dialog}
      <h2 id="hosted-tables" className="mb-1 text-lg font-semibold">
        Your tables
      </h2>
      <p className="mb-4 text-sm text-mist">
        Tables you created. A table nobody has open is deleted automatically after 30 minutes.
      </p>
      {error && (
        <p role="alert" className="mb-3 text-sm text-suit-red">
          {error}
        </p>
      )}
      <ul className="space-y-3">
        {tables.map((t) => (
          <li key={t.id}>
            <Panel className="flex flex-wrap items-center gap-x-5 gap-y-3 p-4 sm:p-5" data-hosted-table={t.id}>
              <div className="min-w-0 flex-1 basis-40">
                <p className="flex items-center gap-2">
                  <span className="truncate font-semibold">{t.name}</span>
                  <Badge>{t.is_private ? "Private" : "Public"}</Badge>
                </p>
                <p className="mt-0.5 text-sm text-mist">
                  Blinds {formatChips(t.small_blind)}/{formatChips(t.big_blind)} · {t.seated}/{t.max_players} seated
                  {t.is_private && (
                    <>
                      {" "}
                      · Code <span className="font-mono tracking-wider text-cream">{t.room_code}</span>
                    </>
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                <ButtonLink href={`/table/${t.id}`} size="sm" variant="secondary">
                  Open
                </ButtonLink>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={busy === t.id}
                  onClick={() => void remove(t)}
                  aria-label={`Delete ${t.name}`}
                >
                  <Trash2 className="size-4" /> {busy === t.id ? "Deleting…" : "Delete"}
                </Button>
              </div>
            </Panel>
          </li>
        ))}
      </ul>
    </section>
  );
}
