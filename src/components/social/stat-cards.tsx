import { Panel } from "@/components/ui/panel";
import { formatChips } from "@/lib/utils";

export type PlayerStats = {
  hands_played: number;
  hands_won: number;
  total_won: number;
  biggest_pot: number;
};

export function winRate(played: number, won: number): string {
  return played > 0 ? `${((won / played) * 100).toFixed(1)}%` : "—";
}

/** The four headline statistics, shared by the private and public profile pages. */
export function StatCards({ stats }: { stats: PlayerStats | null }) {
  const played = stats?.hands_played ?? 0;
  const won = stats?.hands_won ?? 0;
  const cards = [
    { label: "Hands played", value: formatChips(played) },
    { label: "Hands won", value: formatChips(won) },
    { label: "Win rate", value: winRate(played, won) },
    { label: "Biggest pot won", value: formatChips(Number(stats?.biggest_pot ?? 0)) },
    { label: "Total winnings", value: formatChips(Number(stats?.total_won ?? 0)) },
  ];
  return (
    <dl className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      {cards.map((s, i) => (
        <Panel key={s.label} className={i === 4 ? "col-span-2 p-5 lg:col-span-1" : "p-5"}>
          <dt className="text-xs font-medium tracking-wide text-mist uppercase">{s.label}</dt>
          <dd className="mt-2 font-display text-2xl font-bold tabular-nums">{s.value}</dd>
        </Panel>
      ))}
    </dl>
  );
}
