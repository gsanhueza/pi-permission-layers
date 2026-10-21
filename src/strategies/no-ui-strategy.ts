import { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { execFile } from "node:child_process";
import { SettingsService } from "../core/settings";
import type { PermissionLevel, PermissionMode } from "../core/types";
import { BasePermissionStrategy } from "./base-strategy";

/**
 * No-UI strategy — always session-only state changes.
 *
 * Inherits all presentation hooks from BasePermissionStrategy (NoUI defaults).
 */
export class NoUIPermissionStrategy extends BasePermissionStrategy {
  /**
   * Create a NoUIPermissionStrategy with optional overrides for testing.
   *
   * @param settingsService - Settings service (defaults to agent dir).
   * @param execFileFn - Child process execFile (defaults to node:child_process.execFile).
   */
  constructor(settingsService?: SettingsService, execFileFn?: typeof execFile) {
    super(settingsService, execFileFn as any);
  }

  // ── State ────────────────────────────────────────────────────────

  /**
   * Set the permission level (always session-only in no-UI mode).
   *
   * @param level - The permission level to set.
   * @param _saveGlobally - Ignored in no-UI mode.
   * @param _ctx - Ignored in no-UI mode.
   */
  override setLevel(
    level: PermissionLevel,
    _saveGlobally: boolean,
    _ctx: ExtensionContext,
  ): void {
    this.state.currentLevel = level;
    this.state.isSessionOnly = true;
  }

  /**
   * Set the permission mode (always session-only in no-UI mode).
   *
   * @param mode - The permission mode to set.
   * @param _saveGlobally - Ignored in no-UI mode.
   */
  override setMode(mode: PermissionMode, _saveGlobally: boolean): void {
    this.state.permissionMode = mode;
    this.state.isModeSessionOnly = true;
  }
}
