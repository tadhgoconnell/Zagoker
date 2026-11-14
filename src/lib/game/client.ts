import type { ApiResult } from "./types";

/** Calls the game API from the browser and normalises the result. */
export async function apiCall<T = { ok: true }>(
  url: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    const json = await res.json().catch(() => null);
    if (res.ok) return { ok: true, data: json as T };
    return {
      ok: false,
      status: res.status,
      code: json?.error?.code ?? "server_error",
      message: json?.error?.message ?? "Something went wrong. Please try again.",
    };
  } catch {
    return {
      ok: false,
      status: 0,
      code: "offline",
      message: "Connection problem. Check your internet and try again.",
    };
  }
}
