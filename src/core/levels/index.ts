/**
 * Level classification exports
 *
 * Each level has its own file with the constants and classification function.
 * The classifier.ts file imports these and composes them into the full pipeline.
 */

export { isMinimalLevel, extractXargsCommand } from "./minimal.js";
export { isMediumLevel, isSafeRunScript } from "./medium.js";
export { isHighLevel } from "./high.js";

/**
 * Shared helper used by all level classifiers and the main pipeline.
 * Extracts the command name from a token array (handles paths, backslash escapes).
 */
export function getCommandName(tokens: string[]): string {
  if (tokens.length === 0) return "";

  let cmd = tokens[0];

  if (cmd.includes("/")) {
    cmd = cmd.split("/").pop() || cmd;
  }

  if (cmd.startsWith("\\")) {
    cmd = cmd.slice(1);
  }

  return cmd.toLowerCase();
}
