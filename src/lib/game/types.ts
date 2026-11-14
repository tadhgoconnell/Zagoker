import type { AvatarKey } from "@/config/avatars";
import type { HandView } from "@/lib/poker";

/** Shapes returned by the table API. Safe to import from client components. */

export type TableInfo = {
  id: string;
  name: string;
  owner_id: string;
  is_private: boolean;
  room_code: string;
  max_players: number;
  small_blind: number;
  big_blind: number;
  buy_in: number;
  status: "open" | "closed";
  hand_number: number;
};

export type SeatInfo = {
  seat_no: number;
  user_id: string;
  stack: number;
  status: "active" | "sitting_out" | "leaving";
  profiles: { username: string; avatar: AvatarKey } | null;
};

export type TableSnapshot = {
  table: TableInfo;
  seats: SeatInfo[];
  mySeat: number | null;
  hand: HandView | null;
  handNumber: number;
  turnDeadline: string | null;
  serverNow: string;
};

export type LobbyTable = {
  id: string;
  name: string;
  max_players: number;
  small_blind: number;
  big_blind: number;
  buy_in: number;
  hand_number: number;
  seated: number;
};

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; code: string; message: string };
