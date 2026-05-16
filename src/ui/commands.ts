/**
 * Interactive command handlers - /permission and /permission-mode
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
import { createSettingsList } from "./settings";
import { setLevel, setMode } from "./state";

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

  if (arg === "settings") {
    await ctx.ui.custom<void>((_tui, _theme, _keybindings, done) =>
      createSettingsList(() => done()),
    );
    return;
  }

  if (arg && LEVELS.includes(arg as PermissionLevel)) {
    const newLevel = arg as PermissionLevel;

    const scope = await ctx.ui.select("Save permission level to:", [
      "Session only",
      "Global (persists)",
    ]);
    if (!scope) return;

    setLevel(state, newLevel, scope === "Global (persists)", ctx);
    const saveMsg =
      scope === "Global (persists)" ? " (saved globally)" : " (session only)";
    ctx.ui.notify(
      `Permission: ${LEVEL_INFO[newLevel].label}${saveMsg}`,
      "info",
    );
    return;
  }

  const options = LEVELS.map((level) => {
    const info = LEVEL_INFO[level];
    const marker = level === state.currentLevel ? " ← current" : "";
    return `${info.label}: ${info.desc}${marker}`;
  });

  const choice = await ctx.ui.select("Select permission level", options);
  if (!choice) return;

  const selectedLabel = choice.split(":")[0].trim();
  const newLevel = LEVELS.find((l) => LEVEL_INFO[l].label === selectedLabel);
  if (!newLevel || newLevel === state.currentLevel) return;

  const scope = await ctx.ui.select("Save to:", [
    "Session only",
    "Global (persists)",
  ]);
  if (!scope) return;

  setLevel(state, newLevel, scope === "Global (persists)", ctx);
  const saveMsg =
    scope === "Global (persists)" ? " (saved globally)" : " (session only)";
  ctx.ui.notify(`Permission: ${LEVEL_INFO[newLevel].label}${saveMsg}`, "info");
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

    const scope = await ctx.ui.select("Save permission mode to:", [
      "Session only",
      "Global (persists)",
    ]);
    if (!scope) return;

    setMode(state, newMode, scope === "Global (persists)");
    const saveMsg =
      scope === "Global (persists)" ? " (saved globally)" : " (session only)";
    ctx.ui.notify(
      `Permission mode: ${PERMISSION_MODE_INFO[newMode].label}${saveMsg}`,
      "info",
    );
    return;
  }

  const options = PERMISSION_MODES.map((mode) => {
    const info = PERMISSION_MODE_INFO[mode];
    const marker = mode === state.permissionMode ? " ← current" : "";
    return `${info.label}: ${info.desc}${marker}`;
  });

  const choice = await ctx.ui.select("Select permission mode", options);
  if (!choice) return;

  const selectedLabel = choice.split(":")[0].trim();
  const newMode = PERMISSION_MODES.find(
    (m) => PERMISSION_MODE_INFO[m].label === selectedLabel,
  );
  if (!newMode || newMode === state.permissionMode) return;

  const scope = await ctx.ui.select("Save to:", [
    "Session only",
    "Global (persists)",
  ]);
  if (!scope) return;

  setMode(state, newMode, scope === "Global (persists)");
  const saveMsg =
    scope === "Global (persists)" ? " (saved globally)" : " (session only)";
  ctx.ui.notify(
    `Permission mode: ${PERMISSION_MODE_INFO[newMode].label}${saveMsg}`,
    "info",
  );
};
