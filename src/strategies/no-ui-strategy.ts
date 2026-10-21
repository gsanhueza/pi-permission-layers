import {
  ExtensionCommandContext,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { SettingsService } from "../core/settings";
import type { PermissionLevel, PermissionMode } from "../core/types";
import { LEVEL_INFO, PERMISSION_MODE_INFO } from "../core/types";
import { BasePermissionStrategy } from "./base-strategy";
import { notify } from "./internal/commands";
import { checkPermission } from "./internal/permission-check";

const PREFIX = "[pi-permission-layers] ";

/**
 * No-UI strategy — returns block messages, no prompts or status bar.
 */
export class NoUIPermissionStrategy extends BasePermissionStrategy {
  /**
   * Create a NoUIPermissionStrategy with optional overrides for testing.
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
   * Override: always session-only in no-UI mode.
   *
   * @param level - The new permission level.
   * @param _saveGlobally - Ignored in no-UI mode.
   * @param _ctx - Ignored in no-UI mode.
   */
  override setLevel(
    level: PermissionLevel,
    _saveGlobally: boolean,
    _ctx: ExtensionContext,
  ): void {
    // No-UI always session-only
    this.state.currentLevel = level;
    this.state.isSessionOnly = true;
  }

  /**
   * Override: always session-only in no-UI mode.
   *
   * @param mode - The new permission mode.
   * @param _saveGlobally - Ignored in no-UI mode.
   */
  override setMode(mode: PermissionMode, _saveGlobally: boolean): void {
    // No-UI always session-only
    this.state.permissionMode = mode;
    this.state.isModeSessionOnly = true;
  }

  // ── Presentation hooks ───────────────────────────────────────────

  /** Return a block message for dangerous commands in no-UI mode. */
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

  /**
   * Return a block message when permission is insufficient in no-UI mode.
   *
   * @param requiredLevel - The level that was required.
   * @param message - The short message.
   * @param _details - The detailed description (unused in no-UI).
   * @param _ctx - Ignored in no-UI mode.
   * @returns A block result with a helpful error message.
   */
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

  /** No-op: no-UI mode has no notifications for allowed MCP calls. */
  protected onMcpAllowed(_toolName: string, _ctx: ExtensionContext): void {
    // No-UI: nothing to notify (allowed by level check)
  }

  /** No-op: no-UI mode has no session-start notifications. */
  protected onSessionStart(_ctx: ExtensionContext): void {
    // No-UI: nothing to notify
  }

  /** Notify the user of their current permission level in no-UI mode. */
  protected async onViewLevel(ctx: ExtensionCommandContext): Promise<void> {
    notify(
      ctx,
      `Current permission: ${LEVEL_INFO[this.state.currentLevel].label} (${LEVEL_INFO[this.state.currentLevel].desc})`,
      "info",
      PREFIX,
    );
  }

  /** Set the level (session-only) and notify the user in no-UI mode. */
  protected async onSetLevel(
    level: PermissionLevel,

    ctx: ExtensionCommandContext,
  ): Promise<void> {
    this.setLevel(level, false, ctx);
    notify(ctx, `Permission: ${LEVEL_INFO[level].label}`, "info", PREFIX);
  }

  /** Notify the user of their current permission mode in no-UI mode. */
  protected async onViewMode(ctx: ExtensionCommandContext): Promise<void> {
    notify(
      ctx,
      `Current permission mode: ${PERMISSION_MODE_INFO[this.state.permissionMode].label} (${PERMISSION_MODE_INFO[this.state.permissionMode].desc})`,
      "info",
      PREFIX,
    );
  }

  /** Set the mode (session-only) and notify the user in no-UI mode. */
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

  /** No-op: settings UI is not available in no-UI mode. */
  protected async onSettings(_ctx: ExtensionCommandContext): Promise<void> {
    // No-UI: settings not available
  }

  protected override configPrefix(): string {
    return PREFIX;
  }
}
