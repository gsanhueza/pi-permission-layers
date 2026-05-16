/**
 * Non-interactive permission command handlers
 */

import { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import type { PermissionState } from "../core/interfaces";
import type { PermissionLevel, PermissionMode } from "../core/types";
import {
  LEVELS,
  LEVEL_INFO,
  PERMISSION_MODES,
  PERMISSION_MODE_INFO,
} from "../core/types";
import { handleConfigSubcommand } from "../shared/commands";
import { setLevel, setMode } from "../ui/state";

// ============================================================================
// /permission COMMAND
// ============================================================================

export const handlePermissionCommand = async (
  state: PermissionState,
  args: string,
  ctx: ExtensionCommandContext,
): Promise<void> => {
  const arg = args.trim().toLowerCase();

  if (arg === "config" || arg.startsWith("config ")) {
    const configArgs = arg.replace(/^config\s*/, "");
    await handleConfigSubcommand(configArgs, ctx);
    return;
  }

  if (arg && LEVELS.includes(arg as PermissionLevel)) {
    const newLevel = arg as PermissionLevel;
    setLevel(state, newLevel, false, ctx);
    ctx.ui.notify(`Permission: ${LEVEL_INFO[newLevel].label}`, "info");
    return;
  }

  ctx.ui.notify(
    `Current permission: ${LEVEL_INFO[state.currentLevel].label} (${LEVEL_INFO[state.currentLevel].desc})`,
    "info",
  );
};

// ============================================================================
// /permission-mode COMMAND
// ============================================================================

export const handlePermissionModeCommand = async (
  state: PermissionState,
  args: string,
  ctx: ExtensionCommandContext,
): Promise<void> => {
  const arg = args.trim().toLowerCase();

  if (arg && PERMISSION_MODES.includes(arg as PermissionMode)) {
    const newMode = arg as PermissionMode;
    setMode(state, newMode, false);
    ctx.ui.notify(
      `Permission mode: ${PERMISSION_MODE_INFO[newMode].label}`,
      "info",
    );
    return;
  }

  ctx.ui.notify(
    `Current permission mode: ${PERMISSION_MODE_INFO[state.permissionMode].label} (${PERMISSION_MODE_INFO[state.permissionMode].desc})`,
    "info",
  );
};
