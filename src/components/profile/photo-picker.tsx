"use client";

import { Camera, ImageUp, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { AvatarKey } from "@/config/avatars";
import { PHOTO_BUCKET, squarePhoto } from "@/lib/photos";
import { createClient } from "@/lib/supabase/client";

const MAX_INPUT_BYTES = 30 * 1024 * 1024; // the original; it is shrunk before upload

/**
 * Use a photo from the camera roll, or take one. On phones and tablets the
 * "Choose a photo" button offers the photo library and the camera; "Take a
 * photo" opens the front camera directly. The picture is cropped to a square
 * and shrunk in the browser before upload, so only a small JPEG leaves the
 * device, without location data.
 */
export function PhotoPicker({
  userId,
  avatar,
  photo,
  photoPath,
}: {
  userId: string;
  avatar: AvatarKey;
  photo: string | null;
  photoPath: string | null;
}) {
  const router = useRouter();
  const choose = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [touch, setTouch] = useState(false);

  // Only phones and tablets get a separate "Take a photo" button.
  useEffect(() => {
    const t = setTimeout(() => setTouch(window.matchMedia("(pointer: coarse)").matches), 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setMessage(null);
    if (!file.type.startsWith("image/")) {
      setMessage({ tone: "error", text: "That file is not a picture." });
      return;
    }
    if (file.size > MAX_INPUT_BYTES) {
      setMessage({ tone: "error", text: "That picture is too large. Choose one under 30 MB." });
      return;
    }
    setBusy(true);
    try {
      const small = await squarePhoto(file);
      setPreview(URL.createObjectURL(small));
      const supabase = createClient();
      // A new name per upload, so a changed photo shows at once everywhere. The
      // cache time is kept short so a removed photo stops being served within
      // the hour.
      const path = `${userId}/${Date.now()}.jpg`;
      const up = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(path, small, { contentType: "image/jpeg", cacheControl: "3600", upsert: false });
      if (up.error) throw new Error(up.error.message);
      const saved = await supabase.from("profiles").update({ avatar_path: path }).eq("id", userId);
      if (saved.error) {
        await supabase.storage.from(PHOTO_BUCKET).remove([path]);
        throw new Error(saved.error.message);
      }
      if (photoPath) await supabase.storage.from(PHOTO_BUCKET).remove([photoPath]); // tidy up the old one
      setMessage({ tone: "success", text: "Photo updated." });
      router.refresh();
    } catch (e) {
      setPreview(null);
      const text = e instanceof Error && /bucket|not found|row-level/i.test(e.message)
        ? "Photo uploads are not switched on yet."
        : "The photo could not be saved. Please try again.";
      setMessage({ tone: "error", text });
    } finally {
      setBusy(false);
      if (choose.current) choose.current.value = "";
      if (camera.current) camera.current.value = "";
    }
  };

  const remove = async () => {
    setBusy(true);
    setMessage(null);
    const supabase = createClient();
    const saved = await supabase.from("profiles").update({ avatar_path: null }).eq("id", userId);
    if (saved.error) setMessage({ tone: "error", text: "The photo could not be removed. Please try again." });
    else {
      if (photoPath) await supabase.storage.from(PHOTO_BUCKET).remove([photoPath]);
      setPreview(null);
      setMessage({ tone: "success", text: "Photo removed." });
      router.refresh();
    }
    setBusy(false);
  };

  const shown = preview ?? photo;
  return (
    <div>
      <div className="flex items-center gap-4">
        <Avatar avatar={avatar} photo={shown} size="lg" className={busy ? "opacity-60" : ""} />
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => choose.current?.click()}>
            <ImageUp className="size-4" /> {busy ? "Saving…" : shown ? "Change photo" : "Choose a photo"}
          </Button>
          {touch && (
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => camera.current?.click()}>
              <Camera className="size-4" /> Take a photo
            </Button>
          )}
          {photo && (
            <Button variant="ghost" size="sm" disabled={busy} onClick={remove} aria-label="Remove photo">
              <Trash2 className="size-4" /> Remove
            </Button>
          )}
        </div>
      </div>
      {/* No `capture`: phones offer both the photo library and the camera. */}
      <input ref={choose} type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0])} data-photo-input />
      <input ref={camera} type="file" accept="image/*" capture="user" hidden onChange={(e) => upload(e.target.files?.[0])} />
      {message && (
        <Alert tone={message.tone} className="mt-4">
          {message.text}
        </Alert>
      )}
      <p className="mt-3 text-xs text-slate">
        Everyone at your tables and on the leaderboard can see your photo. It is cropped to a square and shrunk on
        your device before upload.
      </p>
    </div>
  );
}
