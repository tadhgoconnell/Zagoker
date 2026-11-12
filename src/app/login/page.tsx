import type { Metadata } from "next";
import { StageNotice } from "@/components/layout/stage-notice";

export const metadata: Metadata = { title: "Log in" };

export default function Page() {
  return (
    <StageNotice title="Log in" stage={2}>
      Accounts are not built yet. Login, logout and password reset are implemented with Supabase Authentication in the next stage.
    </StageNotice>
  );
}
