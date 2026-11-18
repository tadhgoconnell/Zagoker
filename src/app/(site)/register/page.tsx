import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/forms";
import { Chip } from "@/components/ui/chip";
import { gameConfig, routes } from "@/config/site";
import { formatChips } from "@/lib/utils";

export const metadata: Metadata = { title: "Sign up" };

export default function RegisterPage() {
  return (
    <AuthCard
      title="Create your account"
      subtitle={
        <span className="inline-flex items-center gap-1.5">
          <Chip className="size-4" />
          {formatChips(gameConfig.startingChips)} free virtual chips to start. No payment, ever.
        </span>
      }
      footer={<>Already have an account? <Link href={routes.login} className="font-medium text-accent-300 hover:text-accent-200">Log in</Link></>}
    >
      <RegisterForm />
    </AuthCard>
  );
}
