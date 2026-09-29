import { ExtensionContext } from "@earendil-works/pi-coding-agent";

export const hasInteractiveUI = (ctx: ExtensionContext): boolean => {
  // If pi says no UI, respect that
  if (!ctx?.hasUI) return false;

  const mode = getPiModeFromArgv()?.toLowerCase();
  if (mode && mode !== "interactive") return false;

  return true;
};

const getPiModeFromArgv = (
  argv: string[] = process.argv,
): string | undefined => {
  const eq = argv.find((a) => a.startsWith("--mode="));
  if (eq) return eq.slice("--mode=".length);

  const idx = argv.indexOf("--mode");
  if (idx !== -1 && idx + 1 < argv.length) return argv[idx + 1];

  return undefined;
};
