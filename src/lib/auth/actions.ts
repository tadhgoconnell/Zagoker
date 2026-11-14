"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isAvatarKey } from "@/config/avatars";
import { routes } from "@/config/site";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  safeNextPath,
} from "@/lib/auth/schemas";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type FormState = {
  /** Form-level error. */
  error?: string;
  /** Form-level success message. */
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Submitted values to refill the form (never includes passwords). */
  values?: Record<string, string>;
};

const NOT_CONFIGURED: FormState = {
  error:
    "The site is not connected to its database yet. Add the Supabase keys to the environment and restart.",
};

const GENERIC_ERROR = "Something went wrong. Please try again.";

function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

/** Supabase could not be reached at all (network failure, project paused). */
function isUnreachable(error: { status?: number; name?: string }) {
  return (
    error.name === "AuthRetryableFetchError" ||
    !error.status ||
    error.status >= 500
  );
}

const UNREACHABLE =
  "We could not reach the server. Please try again in a moment.";

function isRateLimited(error: { status?: number; code?: string }) {
  return error.status === 429 || error.code?.includes("rate_limit");
}

export async function registerAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;

  const raw = {
    email: String(formData.get("email") ?? ""),
    username: String(formData.get("username") ?? ""),
    password: String(formData.get("password") ?? ""),
  };
  const values = { email: raw.email, username: raw.username };

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsOf(parsed.error), values };
  }
  const { email, username, password } = parsed.data;

  const supabase = await createClient();

  // Friendly early check. The database's unique constraint is what actually
  // guarantees uniqueness if two people submit the same name at once.
  const { data: taken, error: lookupError } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (lookupError) return { error: UNREACHABLE, values };
  if (taken) {
    return { fieldErrors: { username: "That username is taken." }, values };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username },
      emailRedirectTo: `${publicEnv.siteUrl}/auth/callback`,
    },
  });

  if (error) {
    if (isRateLimited(error)) {
      return { error: "Too many attempts. Please wait a minute and try again.", values };
    }
    if (error.code === "user_already_exists") {
      return { fieldErrors: { email: "An account with this email already exists." }, values };
    }
    if (error.code === "weak_password") {
      return { fieldErrors: { password: "Choose a stronger password." }, values };
    }
    // The sign-up trigger rejected the row: the username was claimed between
    // our check and the insert.
    if (error.message.toLowerCase().includes("database error")) {
      return { fieldErrors: { username: "That username is taken." }, values };
    }
    return { error: GENERIC_ERROR, values };
  }

  if (data.session) {
    redirect(`${routes.profile}?welcome=1`);
  }

  // No session means the Supabase project still requires email confirmation.
  // (With confirmation on, Supabase also returns a user with no identities
  // for an email that is already registered, without revealing that fact.)
  return {
    message:
      "Almost there. Check your email for a confirmation link, then log in.",
  };
}

export async function loginAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;

  const raw = {
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  };
  const values = { email: raw.email };

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsOf(parsed.error), values };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    if (isRateLimited(error)) {
      return { error: "Too many attempts. Please wait a minute and try again.", values };
    }
    if (error.code !== "invalid_credentials" && isUnreachable(error)) {
      return { error: UNREACHABLE, values };
    }
    if (error.code === "email_not_confirmed") {
      return { error: "Confirm your email address first, then log in.", values };
    }
    // Same message for unknown email and wrong password, on purpose.
    return { error: "Incorrect email or password.", values };
  }

  redirect(safeNextPath(formData.get("next"), routes.lobby));
}

export async function logoutAction(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect(routes.home);
}

export async function forgotPasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;

  const raw = { email: String(formData.get("email") ?? "") };
  const parsed = forgotPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsOf(parsed.error), values: raw };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${publicEnv.siteUrl}/auth/callback?next=${encodeURIComponent(routes.resetPassword)}`,
  });

  if (error && isRateLimited(error)) {
    return { error: "Too many requests. Please wait a few minutes and try again.", values: raw };
  }

  // Same answer whether or not the address has an account.
  return {
    message:
      "If an account exists for that email, a password reset link is on its way.",
  };
}

export async function resetPasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;

  const parsed = resetPasswordSchema.safeParse({
    password: String(formData.get("password") ?? ""),
    confirm: String(formData.get("confirm") ?? ""),
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "This reset link has expired. Request a new one." };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    if (error.code === "same_password") {
      return { fieldErrors: { password: "Choose a password you have not used before." } };
    }
    if (error.code === "weak_password") {
      return { fieldErrors: { password: "Choose a stronger password." } };
    }
    return { error: GENERIC_ERROR };
  }

  redirect(`${routes.profile}?password=updated`);
}

export async function updateAvatarAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;

  const avatar = formData.get("avatar");
  if (!isAvatarKey(avatar)) return { error: "Unknown avatar." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(routes.login);

  // RLS only lets this touch the caller's own row, and only the avatar column.
  const { error } = await supabase
    .from("profiles")
    .update({ avatar })
    .eq("id", user.id);
  if (error) return { error: GENERIC_ERROR };

  refresh();
  return { message: "Avatar updated." };
}
