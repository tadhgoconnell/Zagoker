import type { Metadata } from "next";
import { StageNotice } from "@/components/layout/stage-notice";

export const metadata: Metadata = { title: "Sign up" };

export default function Page() {
  return (
    <StageNotice title="Sign up" stage={2}>
      Accounts are not built yet. Registration, usernames and the one-time 10,000 chip welcome grant are implemented in the next stage.
    </StageNotice>
  );
}
