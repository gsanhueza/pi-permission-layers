/**
 * Command handlers - /permission and /permission-mode
 */

import { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import type { PermissionState } from "../core/interfaces";
import { loadPermissionConfig, savePermissionConfig } from "../core/settings";
import { invalidateConfigCache } from "../core/tools";
import type { PermissionLevel, PermissionMode } from "../core/types";
import {
  LEVELS,
  LEVEL_INFO,
  PERMISSION_MODES,
  PERMISSION_MODE_INFO,
} from "../core/types";
import { setLevel, setMode } from "./state";
import { hasInteractiveUI } from "./ui";

// ============================================================================
// /permission COMMAND
// ============================================================================

const handleConfigSubcommand = async (
  state: PermissionState,
  args: string,
  ctx: ExtensionCommandContext,
): Promise<void> => {
  const parts = args.trim().split(/\s+/);
  const action = parts[0];

  if (action === "show") {
    const config = loadPermissionConfig();
    const configStr = JSON.stringify(config, null, 2);
    ctx.ui.notify(`Permission Config:\n${configStr}`, "info");
    return;
  }

  if (action === "reset") {
    savePermissionConfig({});
    invalidateConfigCache();
    ctx.ui.notify("Permission config reset to defaults", "info");
    return;
  }

  const help = `Usage: /permission config <action>

Actions:
  show  - Display current configuration
  reset - Reset to default configuration

Edit ~/.pi/agent/settings.json directly for full control:

{
  "permissionConfig": {
    "overrides": {
      "minimal": ["tmux list-*", "tmux show-*"],
      "medium": ["tmux *", "screen *"],
      "high": ["rm -rf *"],
      "dangerous": ["dd if=* of=/dev/*"]
    },
    "prefixMappings": [
      { "from": "fvm flutter", "to": "flutter" },
      { "from": "nvm exec", "to": "" }
    ]
  }
}`;

  ctx.ui.notify(help, "info");
};

export const handlePermissionCommand = async (
  state: PermissionState,
  args: string,
  ctx: ExtensionCommandContext,
): Promise<void> => {
  const arg = args.trim().toLowerCase();

  if (arg === "config" || arg.startsWith("config ")) {
    const configArgs = arg.replace(/^config\s*/, "");
    await handleConfigSubcommand(state, configArgs, ctx);
    return;
  }

  if (arg && LEVELS.includes(arg as PermissionLevel)) {
    const newLevel = arg as PermissionLevel;

    if (hasInteractiveUI(ctx)) {
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
    } else {
      setLevel(state, newLevel, false, ctx);
      ctx.ui.notify(`Permission: ${LEVEL_INFO[newLevel].label}`, "info");
    }
    return;
  }

  if (!hasInteractiveUI(ctx)) {
    ctx.ui.notify(
      `Current permission: ${LEVEL_INFO[state.currentLevel].label} (${LEVEL_INFO[state.currentLevel].desc})`,
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

    if (hasInteractiveUI(ctx)) {
      const scope = await ctx.ui.select("Save permission mode to:", [
        "Session only",
        "Global (persists)",
      ]);
      if (!scope) return;

      setMode(state, newMode, scope === "Global (persists)", ctx);
      const saveMsg =
        scope === "Global (persists)" ? " (saved globally)" : " (session only)";
      ctx.ui.notify(
        `Permission mode: ${PERMISSION_MODE_INFO[newMode].label}${saveMsg}`,
        "info",
      );
    } else {
      setMode(state, newMode, false, ctx);
      ctx.ui.notify(
        `Permission mode: ${PERMISSION_MODE_INFO[newMode].label}`,
        "info",
      );
    }
    return;
  }

  if (!hasInteractiveUI(ctx)) {
    ctx.ui.notify(
      `Current permission mode: ${PERMISSION_MODE_INFO[state.permissionMode].label} (${PERMISSION_MODE_INFO[state.permissionMode].desc})`,
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

  setMode(state, newMode, scope === "Global (persists)", ctx);
  const saveMsg =
    scope === "Global (persists)" ? " (saved globally)" : " (session only)";
  ctx.ui.notify(
    `Permission mode: ${PERMISSION_MODE_INFO[newMode].label}${saveMsg}`,
    "info",
  );
};
