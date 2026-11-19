/**
 * Special treatment for particular players, by username (case-insensitive).
 * Display only: usernames in the database are unchanged.
 */

/** Players shown in gold with a crown on their picture. */
export const crownedUsernames = ["scribe"];

/** Any name containing one of these is shown as the given nickname. */
export const nicknameRules: { contains: string; show: string }[] = [{ contains: "merto", show: "DURGO 💩" }];
