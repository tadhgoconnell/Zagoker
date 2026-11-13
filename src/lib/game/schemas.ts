import { z } from "zod";

const chips = z.number().int().positive().max(1_000_000_000);

export const createTableSchema = z
  .object({
    name: z.string().trim().min(3, "Table name needs at least 3 characters.").max(40, "Table name is too long."),
    maxPlayers: z.number().int().min(2).max(9),
    smallBlind: chips,
    bigBlind: chips.max(1_000_000, "Big blind is too large."),
    buyIn: chips,
    isPrivate: z.boolean(),
  })
  .refine((t) => t.smallBlind <= t.bigBlind, {
    message: "The small blind cannot be larger than the big blind.",
  })
  .refine((t) => t.buyIn >= t.bigBlind * 10 && t.buyIn <= t.bigBlind * 1000, {
    message: "The starting stack must be between 10 and 1,000 big blinds.",
  });

export const joinTableSchema = z.object({
  seat: z.number().int().min(0).max(8).optional(),
  roomCode: z.string().trim().max(16).optional(),
});

export const actionSchema = z.object({
  /** The hand version the player was looking at when they acted. */
  version: z.number().int().min(0),
  action: z.discriminatedUnion("type", [
    z.object({ type: z.literal("fold") }),
    z.object({ type: z.literal("check") }),
    z.object({ type: z.literal("call") }),
    z.object({ type: z.literal("allin") }),
    z.object({ type: z.literal("bet"), amount: z.number().int().positive() }),
    z.object({ type: z.literal("raise"), amount: z.number().int().positive() }),
  ]),
});
