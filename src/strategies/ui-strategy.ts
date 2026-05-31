import {
  ExtensionCommandContext,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type { PermissionLevel, PermissionMode } from "../core/types";
import {
  LEVELS,
  LEVEL_INFO,
  PERMISSION_MODES,
  PERMISSION_MODE_INFO,
} from "../core/types";
import { notify } from "../shared/commands";
import { checkPermission } from "../shared/permission-check";
import { createSettingsList } from "../ui/settings";
import { getStatusText, isQuietMode, notifySystem } from "../ui/ui";
import { BasePermissionStrategy } from "./base-strategy";

/**
 * UI strategy — uses prompts, status bar, and system notifications.
 */
export class UIPermissionStrategy extends BasePermissionStrategy {
  // ── State ────────────────────────────────────────────────────────

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

  protected async onDangerous(
    command: string,

    ctx: ExtensionContext,
  ): Promise<{ block: true; reason: string } | undefined> {
    await notifySystem(
      "⚠️ Permission Required",
      `Dangerous command: ${command}`,
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

  protected onMcpAllowed(toolName: string, ctx: ExtensionContext): void {
    notify(ctx, `MCP tool: ${toolName}`);
  }

  protected onSessionStart(ctx: ExtensionContext): void {
    if (ctx.ui?.setStatus) {
      ctx.ui.setStatus("authority", getStatusText(this.state.currentLevel));
    }
    if (this.state.currentLevel === "bypassed") {
      notify(ctx, "⚠️ Permission bypassed - all checks disabled!", "warning");
    } else if (!isQuietMode(ctx)) {
      notify(
        ctx,
        `Permission: ${getStatusText(this.state.currentLevel)} (use /permission to change)`,
      );
    }
    if (this.state.permissionMode === "block") {
      notify(ctx, "Permission mode: Block (use /permission-mode to change)");
    }
  }

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

  protected async onSettings(ctx: ExtensionCommandContext): Promise<void> {
    await ctx.ui.custom<void>((_tui, _theme, _keybindings, done) =>
      createSettingsList(() => done()),
    );
  }
}
