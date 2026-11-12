import type { Metadata } from "next";
import { StageNotice } from "@/components/layout/stage-notice";

export const metadata: Metadata = { title: "Leaderboard" };

export default function Page() {
  return (
    <StageNotice title="Leaderboard" stage={6}>
      Rankings need real players and real hands. The leaderboard is built alongside profiles and statistics.
    </StageNotice>
  );
}
