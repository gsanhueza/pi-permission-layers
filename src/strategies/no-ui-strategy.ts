import {
  ExtensionCommandContext,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type { PermissionLevel, PermissionMode } from "../core/types";
import { LEVEL_INFO, PERMISSION_MODE_INFO } from "../core/types";
import { notify } from "../shared/commands";
import { checkPermission } from "../shared/permission-check";
import { BasePermissionStrategy } from "./base-strategy";

const PREFIX = "[pi-permission-layers] ";

/**
 * No-UI strategy — returns block messages, no prompts or status bar.
 */
export class NoUIPermissionStrategy extends BasePermissionStrategy {
  // ── State ────────────────────────────────────────────────────────

  override setLevel(
    level: PermissionLevel,
    _saveGlobally: boolean,
    _ctx: ExtensionContext,
  ): void {
    // No-UI always session-only
    this.state.currentLevel = level;
    this.state.isSessionOnly = true;
  }

  // ── Presentation hooks ───────────────────────────────────────────

  protected async onDangerous(
    command: string,
    _ctx: ExtensionContext,
  ): Promise<{ block: true; reason: string }> {
    return {
      block: true,
      reason: `Dangerous command requires confirmation: ${command}
User can re-run with: PI_PERMISSION_LEVEL=bypassed pi -p "..."`,
    };
  }

  protected async onRequest(
    requiredLevel: PermissionLevel,
    message: string,
    _details: string,
    _ctx: ExtensionContext,
  ): Promise<{ block: true; reason: string } | undefined> {
    if (checkPermission(this.state, requiredLevel)) return undefined;

    return {
      block: true,
      reason: `${message}
Blocked by permission (${this.state.currentLevel}). Allowed at this level: ${LEVEL_INFO[this.state.currentLevel].desc}
User can re-run with: PI_PERMISSION_LEVEL=${requiredLevel} pi -p "..."`,
    };
  }

  protected onMcpAllowed(_toolName: string, _ctx: ExtensionContext): void {
    // No-UI: nothing to notify (allowed by level check)
  }

  protected onSessionStart(_ctx: ExtensionContext): void {
    // No-UI: nothing to notify
  }

  protected async onViewLevel(ctx: ExtensionCommandContext): Promise<void> {
    notify(
      ctx,
      `Current permission: ${LEVEL_INFO[this.state.currentLevel].label} (${LEVEL_INFO[this.state.currentLevel].desc})`,
      "info",
      PREFIX,
    );
  }

  protected async onSetLevel(
    level: PermissionLevel,

    ctx: ExtensionCommandContext,
  ): Promise<void> {
    this.setLevel(level, false, ctx);
    notify(ctx, `Permission: ${LEVEL_INFO[level].label}`, "info", PREFIX);
  }

  protected async onViewMode(ctx: ExtensionCommandContext): Promise<void> {
    notify(
      ctx,
      `Current permission mode: ${PERMISSION_MODE_INFO[this.state.permissionMode].label} (${PERMISSION_MODE_INFO[this.state.permissionMode].desc})`,
      "info",
      PREFIX,
    );
  }

  protected async onSetMode(
    mode: PermissionMode,

    ctx: ExtensionCommandContext,
  ): Promise<void> {
    this.setMode(mode, false);
    notify(
      ctx,
      `Permission mode: ${PERMISSION_MODE_INFO[mode].label}`,
      "info",
      PREFIX,
    );
  }

  protected async onSettings(_ctx: ExtensionCommandContext): Promise<void> {
    // No-UI: settings not available
  }

  protected override configPrefix(): string {
    return PREFIX;
  }
}
