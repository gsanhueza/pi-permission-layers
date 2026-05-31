import {
  ExtensionCommandContext,
  ExtensionContext,
  ToolCallEvent,
} from "@earendil-works/pi-coding-agent";
import type { PermissionState } from "../core/interfaces";
import type { PermissionLevel, PermissionMode } from "../core/types";

/**
 * Strategy contract for permission-layer operations.
 *
 * Both UI and no-UI implementations share the same algorithm
 * (classify → check dangerous → check level → allow/block).
 * The strategy abstracts only the *presentation* layer:
 * prompts vs. block messages, global vs. session persistence, etc.
 */
export interface PermissionStrategy {
  // ── Commands ──────────────────────────────────────────────────────

  /** Handle the `/permission` command. */
  handlePermissionCommand(
    args: string,
    ctx: ExtensionCommandContext,
  ): Promise<void>;

  /** Handle the `/permission-mode` command. */
  handlePermissionModeCommand(
    args: string,
    ctx: ExtensionCommandContext,
  ): Promise<void>;

  // ── Events ────────────────────────────────────────────────────────

  /** Called on session start (session init + notifications). */
  handleSessionStart(ctx: ExtensionContext): void;

  /**
   * Called on every tool call to decide whether to block or allow.
   *
   * @returns `{ block: true, reason }` to block the tool, or `undefined` to allow.
   */
  handleToolCall(
    event: ToolCallEvent,
    ctx: ExtensionContext,
  ): Promise<{ block: true; reason: string } | undefined>;

  // ── State ─────────────────────────────────────────────────────────

  /** Create a fresh permission state (loads global defaults). */
  createInitialState(): PermissionState;

  /** Set the permission level, optionally persisting globally. */
  setLevel(
    level: PermissionLevel,
    saveGlobally: boolean,
    ctx: ExtensionContext,
  ): void;

  /** Set the permission mode, optionally persisting globally. */
  setMode(mode: PermissionMode, saveGlobally: boolean): void;
}
