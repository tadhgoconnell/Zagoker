import type { Metadata } from "next";
import { StageNotice } from "@/components/layout/stage-notice";

export const metadata: Metadata = { title: "Lobby" };

export default function Page() {
  return (
    <StageNotice title="Lobby" stage={6}>
      The public lobby, table creation and private room joining are built once accounts, the poker engine and real-time play are in place.
    </StageNotice>
  );
}
