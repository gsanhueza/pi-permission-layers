import { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { getCachedConfig } from "../../core/config";

export const hasInteractiveUI = (ctx: ExtensionContext): boolean => {
  // UI override — env
  const envForceUI = process.env.PI_FORCEUI?.toLowerCase();
  if (envForceUI && ["1", "true", "yes"].includes(envForceUI)) return true;

  // UI override — settings
  const settings = getCachedConfig();
  if (settings.forceUI === true) return true;

  // Continue as normal
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
