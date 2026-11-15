import { z } from "zod";

export const usernamePattern = /^[A-Za-z0-9_]{3,20}$/;

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "Email is too long.")
  .pipe(z.email("Enter a valid email address."));

export const usernameSchema = z
  .string()
  .trim()
  .regex(usernamePattern, "3 to 20 characters: letters, numbers and underscores only.");

// bcrypt (used by Supabase) only reads the first 72 bytes of a password.
export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(72, "Use at most 72 characters.");

export const registerSchema = z.object({
  email: emailSchema,
  username: usernameSchema,
  password: passwordSchema,
});

export const guestSchema = z.object({ username: usernameSchema });

export const saveAccountSchema = z.object({ email: emailSchema, password: passwordSchema });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password.").max(72),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "Passwords do not match.",
  });

/** Only allow redirects to paths on this site ("/x"), never to other origins. */
export function safeNextPath(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }
  return value;
}
