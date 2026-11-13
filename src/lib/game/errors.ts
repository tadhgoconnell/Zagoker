/** An expected failure with a stable code the client can react to. */
export class GameError extends Error {
  constructor(
    public code: string,
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "GameError";
  }
}

/** Database exception text -> error shown to the player. */
const known: [pattern: string, code: string, status: number, message: string][] = [
  ["not_authenticated", "not_authenticated", 401, "Please log in."],
  ["stale_version", "stale", 409, "The game has moved on. Refreshing."],
  ["already_seated", "already_seated", 409, "You are already sitting at a table."],
  ["seat_taken", "seat_taken", 409, "That seat has just been taken."],
  ["invalid_seat", "invalid_seat", 400, "That seat does not exist at this table."],
  ["table_full", "table_full", 409, "This table is full."],
  ["invalid_room_code", "invalid_room_code", 403, "That room code is not right."],
  ["insufficient chips", "insufficient_chips", 409, "You do not have enough chips for the buy-in."],
  ["table_not_found", "table_not_found", 404, "This table does not exist or has closed."],
  ["not_seated", "not_seated", 409, "You are not sitting at this table."],
  ["too_many_tables", "too_many_tables", 409, "You already have three open tables. Close one first."],
  ["hand_in_progress", "hand_in_progress", 409, "Wait for the current hand to finish."],
  ["not_table_owner", "not_table_owner", 403, "Only the host can do that."],
  ["not_enough_players", "not_enough_players", 409, "At least two players with chips are needed."],
  ["violates check constraint", "invalid_settings", 400, "Those table settings are not allowed."],
];

/** Converts a Supabase/Postgres error into a GameError. */
export function fromDatabaseError(error: { message: string }): GameError {
  for (const [pattern, code, status, message] of known) {
    if (error.message.includes(pattern)) return new GameError(code, status, message);
  }
  console.error("Unexpected database error:", error.message);
  return new GameError("server_error", 500, "Something went wrong. Please try again.");
}
