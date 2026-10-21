import { ExtensionContext } from "@earendil-works/pi-coding-agent";

/**
 * Determine whether the current session has an interactive UI.
 *
 * @param ctx - Extension context.
 * @returns True if an interactive UI is available.
 */
export const hasInteractiveUI = (ctx: ExtensionContext): boolean => {
  // If pi says no UI, respect that
  if (!ctx?.hasUI) return false;

  const mode = getPiModeFromArgv()?.toLowerCase();
  if (mode && mode !== "interactive") return false;

  return true;
};

/**
 * Extract the --mode argument from the process argv.
 *
 * @param argv - The argv array (defaults to process.argv).
 * @returns The mode string, or undefined.
 */
const getPiModeFromArgv = (
  argv: string[] = process.argv,
): string | undefined => {
  const eq = argv.find((a) => a.startsWith("--mode="));
  if (eq) return eq.slice("--mode=".length);

  const idx = argv.indexOf("--mode");
  if (idx !== -1 && idx + 1 < argv.length) return argv[idx + 1];

  return undefined;
};
