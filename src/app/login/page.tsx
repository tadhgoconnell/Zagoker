import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/forms";
import { routes } from "@/config/site";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <AuthCard
      title="Welcome back"
      subtitle="Log in to get back to the tables."
      footer={<>New here? <Link href={routes.register} className="font-medium text-gold-300 hover:text-gold-200">Create a free account</Link></>}
    >
      {/* The form reads ?next= from the URL, which is only known at request time. */}
      <Suspense fallback={<div className="h-72" />}>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
