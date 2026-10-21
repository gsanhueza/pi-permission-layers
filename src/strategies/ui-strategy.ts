import {
  ExtensionCommandContext,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { SettingsService } from "../core/settings";
import type { PermissionLevel, PermissionMode } from "../core/types";
import {
  LEVELS,
  LEVEL_INFO,
  PERMISSION_MODES,
  PERMISSION_MODE_INFO,
} from "../core/types";
import { BasePermissionStrategy } from "./base-strategy";
import { notify } from "./internal/commands";
import { checkPermission } from "./internal/permission-check";
import { createSettingsList } from "./internal/settings-ui";
import {
  getStatusText,
  isQuietMode,
  notifySystem,
} from "./internal/ui-rendering";

/**
 * UI strategy — uses prompts, status bar, and system notifications.
 */
export class UIPermissionStrategy extends BasePermissionStrategy {
  /**
   * Create a UIPermissionStrategy with optional overrides for testing.
   *
   * @param settingsService - Settings service (defaults to agent dir).
   * @param execFileFn - Child process execFile (defaults to node:child_process.execFile).
   */
  constructor(
    settingsService?: SettingsService,
    execFileFn?: (
      file: string,
      args: readonly string[],
      cb: (err: Error | null, stdout: string, stderr: string) => void,
    ) => void,
  ) {
    super(settingsService, execFileFn);
  }

  // ── State ────────────────────────────────────────────────────────

  /**
   * Set the permission level and update the status bar.
   *
   * @param level - The permission level to set.
   * @param saveGlobally - Whether to persist globally.
   * @param ctx - Extension context for status bar update.
   */
  override setLevel(
    level: PermissionLevel,
    saveGlobally: boolean,
    ctx: ExtensionContext,
  ): void {
    super.setLevel(level, saveGlobally, ctx);
    if (ctx.ui?.setStatus) {
      ctx.ui.setStatus("authority", getStatusText(level));
    }
  }

  // ── Presentation hooks ───────────────────────────────────────────

  /**
   * Present a dangerous-command prompt with system notification.
   *
   * @param command - The dangerous command string.
   * @param ctx - Extension context for the select prompt.
   * @returns Block result if denied, undefined to allow.
   */
  protected async onDangerous(
    command: string,

    ctx: ExtensionContext,
  ): Promise<{ block: true; reason: string } | undefined> {
    await notifySystem(
      "⚠️ Permission Required",
      `Dangerous command: ${command}`,
      this.settingsService,
      this.execFileFn,
    );

    if (this.state.permissionMode === "block") {
      return {
        block: true,
        reason: `Blocked by permission mode (block). Dangerous command: ${command}
Use /permission-mode ask to enable confirmations.`,
      };
    }

    const choice = await ctx.ui.select(`⚠️ Dangerous: $ ${command}`, [
      "Allow once",
      "Cancel",
    ]);

    if (choice !== "Allow once") {
      return {
        block: true,
        reason:
          "Cancelled by the user. Do not attempt to repeat or circumvent.",
      };
    }
    return undefined;
  }

  /**
   * Present a permission request prompt with system notification.
   *
   * @param requiredLevel - The permission level required.
   * @param message - Short description for the prompt.
   * @param _details - Detailed description (unused in prompt).
   * @param ctx - Extension context for the select prompt.
   * @returns Block result if denied, undefined to allow.
   */
  protected async onRequest(
    requiredLevel: PermissionLevel,
    message: string,
    _details: string,
    ctx: ExtensionContext,
  ): Promise<{ block: true; reason: string } | undefined> {
    if (checkPermission(this.state, requiredLevel)) return undefined;

    const requiredInfo = LEVEL_INFO[requiredLevel];
    const currentInfo = LEVEL_INFO[this.state.currentLevel];

    // System notification
    await notifySystem(
      `Permission Required (${requiredInfo.label})`,
      `${message}\nCurrent level: ${currentInfo.label}`,
      this.settingsService,
      this.execFileFn,
    );

    if (this.state.permissionMode === "block") {
      return {
        block: true,
        reason: `${message}
Blocked by permission (${this.state.currentLevel}, mode: block). Requires ${requiredInfo.label}.
Use /permission ${requiredLevel} or /permission-mode ask to enable prompts.`,
      };
    }

    const promptTitle = `[Requires ${requiredInfo.label}]: ${message}`;
    const allowAllLabel = `Allow all ${requiredInfo.label} (session)`;
    const choice = await ctx.ui.select(promptTitle, [
      "Allow once",
      allowAllLabel,
      "Cancel",
    ]);

    if (choice === "Allow once") return undefined;

    if (choice === allowAllLabel) {
      this.setLevel(requiredLevel, false, ctx);
      notify(ctx, `Permission → ${requiredInfo.label} (session only)`);
      return undefined;
    }

    return {
      block: true,
      reason: "Cancelled by the user. Do not attempt to repeat or circumvent.",
    };
  }

  /**
   * Notify the user that an MCP tool call was allowed.
   *
   * @param toolName - The MCP tool name.
   * @param ctx - Extension context for the notification.
   */
  protected onMcpAllowed(toolName: string, ctx: ExtensionContext): void {
    notify(ctx, `MCP tool: ${toolName}`);
  }

  /**
   * Display session-start status bar and notifications.
   *
   * @param ctx - Extension context for status bar and notifications.
   */
  protected onSessionStart(ctx: ExtensionContext): void {
    if (ctx.ui?.setStatus) {
      ctx.ui.setStatus("authority", getStatusText(this.state.currentLevel));
    }
    if (this.state.currentLevel === "bypassed") {
      notify(ctx, "⚠️ Permission bypassed - all checks disabled!", "warning");
    } else if (!isQuietMode(ctx, this.settingsService)) {
      notify(
        ctx,
        `Permission: ${getStatusText(this.state.currentLevel)} (use /permission to change)`,
      );
    }
    if (this.state.permissionMode === "block") {
      notify(ctx, "Permission mode: Block (use /permission-mode to change)");
    }
  }

  /**
   * Present a level-selection dialog and update the level.
   *
   * @param ctx - Extension command context for the select prompts.
   */
  protected async onViewLevel(ctx: ExtensionCommandContext): Promise<void> {
    const options = LEVELS.map((level) => {
      const info = LEVEL_INFO[level];
      const marker = level === this.state.currentLevel ? " ← current" : "";
      return `${info.label}: ${info.desc}${marker}`;
    });

    const choice = await ctx.ui.select("Select permission level", options);
    if (!choice) return;

    const selectedLabel = choice.split(":")[0].trim();
    const newLevel = LEVELS.find((l) => LEVEL_INFO[l].label === selectedLabel);
    if (!newLevel || newLevel === this.state.currentLevel) return;

    const scope = await ctx.ui.select("Save to:", [
      "Session only",
      "Global (persists)",
    ]);
    if (!scope) return;

    const saveGlobally = scope === "Global (persists)";
    this.setLevel(newLevel, saveGlobally, ctx);
    const saveMsg = saveGlobally ? " (saved globally)" : " (session only)";
    notify(ctx, `Permission: ${LEVEL_INFO[newLevel].label}${saveMsg}`);
  }

  /**
   * Prompt the user for scope (session vs global) then set the level.
   *
   * @param level - The permission level to set.
   * @param ctx - Extension command context for the select prompt.
   */
  protected async onSetLevel(
    level: PermissionLevel,

    ctx: ExtensionCommandContext,
  ): Promise<void> {
    const scope = await ctx.ui.select("Save permission level to:", [
      "Session only",
      "Global (persists)",
    ]);
    if (!scope) return;

    const saveGlobally = scope === "Global (persists)";
    this.setLevel(level, saveGlobally, ctx);
    const saveMsg = saveGlobally ? " (saved globally)" : " (session only)";
    notify(ctx, `Permission: ${LEVEL_INFO[level].label}${saveMsg}`);
  }

  /**
   * Present a mode-selection dialog and update the mode.
   *
   * @param ctx - Extension command context for the select prompts.
   */
  protected async onViewMode(ctx: ExtensionCommandContext): Promise<void> {
    const options = PERMISSION_MODES.map((mode) => {
      const info = PERMISSION_MODE_INFO[mode];
      const marker = mode === this.state.permissionMode ? " ← current" : "";
      return `${info.label}: ${info.desc}${marker}`;
    });

    const choice = await ctx.ui.select("Select permission mode", options);
    if (!choice) return;

    const selectedLabel = choice.split(":")[0].trim();
    const newMode = PERMISSION_MODES.find(
      (m) => PERMISSION_MODE_INFO[m].label === selectedLabel,
    );
    if (!newMode || newMode === this.state.permissionMode) return;

    const scope = await ctx.ui.select("Save to:", [
      "Session only",
      "Global (persists)",
    ]);
    if (!scope) return;

    const saveGlobally = scope === "Global (persists)";
    this.setMode(newMode, saveGlobally);
    const saveMsg = saveGlobally ? " (saved globally)" : " (session only)";
    notify(
      ctx,
      `Permission mode: ${PERMISSION_MODE_INFO[newMode].label}${saveMsg}`,
    );
  }

  /**
   * Prompt the user for scope (session vs global) then set the mode.
   *
   * @param mode - The permission mode to set.
   * @param ctx - Extension command context for the select prompt.
   */
  protected async onSetMode(
    mode: PermissionMode,

    ctx: ExtensionCommandContext,
  ): Promise<void> {
    const scope = await ctx.ui.select("Save permission mode to:", [
      "Session only",
      "Global (persists)",
    ]);
    if (!scope) return;

    const saveGlobally = scope === "Global (persists)";
    this.setMode(mode, saveGlobally);
    const saveMsg = saveGlobally ? " (saved globally)" : " (session only)";
    notify(
      ctx,
      `Permission mode: ${PERMISSION_MODE_INFO[mode].label}${saveMsg}`,
    );
  }

  /**
   * Open the settings UI for quiet-startup and notifications.
   *
   * @param ctx - Extension command context for the custom UI.
   */
  protected async onSettings(ctx: ExtensionCommandContext): Promise<void> {
    await ctx.ui.custom<void>((_tui, _theme, _keybindings, done) =>
      createSettingsList(this.settingsService, () => done()),
    );
  }
}
