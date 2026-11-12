import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/forms";
import { routes } from "@/config/site";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Reset your password"
      subtitle="Enter your email and we will send you a link to choose a new password."
      footer={<>Remembered it? <Link href={routes.login} className="font-medium text-gold-300 hover:text-gold-200">Back to log in</Link></>}
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
