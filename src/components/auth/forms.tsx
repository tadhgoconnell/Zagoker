"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { SubmitButton } from "@/components/auth/submit-button";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { routes } from "@/config/site";
import {
  forgotPasswordAction,
  loginAction,
  registerAction,
  resetPasswordAction,
  type FormState,
} from "@/lib/auth/actions";

const initial: FormState = {};

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, initial);

  if (state.message) return <Alert tone="success">{state.message}</Alert>;

  return (
    <form action={action} className="space-y-5" noValidate>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field
        label="Username"
        name="username"
        autoComplete="username"
        required
        minLength={3}
        maxLength={20}
        defaultValue={state.values?.username}
        error={state.fieldErrors?.username}
        hint="3 to 20 characters. Letters, numbers and underscores. Shown to other players."
      />
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
        hint="Only used to log in and reset your password."
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        maxLength={72}
        error={state.fieldErrors?.password}
        hint="At least 8 characters."
      />
      <SubmitButton pending={pending}>Create account</SubmitButton>
    </form>
  );
}

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initial);
  const params = useSearchParams();
  const next = params.get("next") ?? "";
  const linkError = params.get("error") === "link";

  return (
    <form action={action} className="space-y-5" noValidate>
      {state.error ? (
        <Alert tone="error">{state.error}</Alert>
      ) : linkError ? (
        <Alert tone="error">
          That link is invalid or has expired. Request a new one.
        </Alert>
      ) : null}
      <input type="hidden" name="next" value={next} />
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />
      <div>
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          error={state.fieldErrors?.password}
        />
        <Link
          href={routes.forgotPassword}
          className="mt-2 inline-block text-sm text-gold-300 hover:text-gold-200"
        >
          Forgot your password?
        </Link>
      </div>
      <SubmitButton pending={pending}>Log in</SubmitButton>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(forgotPasswordAction, initial);

  if (state.message) return <Alert tone="success">{state.message}</Alert>;

  return (
    <form action={action} className="space-y-5" noValidate>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />
      <SubmitButton pending={pending}>Send reset link</SubmitButton>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(resetPasswordAction, initial);

  return (
    <form action={action} className="space-y-5" noValidate>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        maxLength={72}
        error={state.fieldErrors?.password}
        hint="At least 8 characters."
      />
      <Field
        label="Confirm new password"
        name="confirm"
        type="password"
        autoComplete="new-password"
        required
        error={state.fieldErrors?.confirm}
      />
      <SubmitButton pending={pending}>Save new password</SubmitButton>
    </form>
  );
}
