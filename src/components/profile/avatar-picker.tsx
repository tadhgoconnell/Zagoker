"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { avatarKeys, type AvatarKey } from "@/config/avatars";
import { updateAvatarAction, type FormState } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

const initial: FormState = {};

/** Each avatar is a submit button, so choosing one saves it immediately. */
export function AvatarPicker({ current }: { current: AvatarKey }) {
  const [state, action, pending] = useActionState(updateAvatarAction, initial);

  return (
    <form action={action}>
      <div
        role="group"
        aria-label="Choose an avatar"
        className={cn(
          "grid grid-cols-6 gap-3 transition-opacity sm:flex sm:flex-wrap",
          pending && "opacity-60",
        )}
      >
        {avatarKeys.map((key) => {
          const selected = key === current;
          return (
            <button
              key={key}
              type="submit"
              name="avatar"
              value={key}
              disabled={pending || selected}
              aria-label={`${key} avatar${selected ? " (current)" : ""}`}
              aria-pressed={selected}
              className={cn(
                "grid aspect-square place-items-center rounded-full p-0.5 transition-all sm:size-13",
                selected
                  ? "ring-2 ring-gold-400"
                  : "opacity-70 ring-1 ring-transparent hover:scale-105 hover:opacity-100",
              )}
            >
              <Avatar avatar={key} className="size-full" />
            </button>
          );
        })}
      </div>
      {state.error && (
        <Alert tone="error" className="mt-4">
          {state.error}
        </Alert>
      )}
    </form>
  );
}
