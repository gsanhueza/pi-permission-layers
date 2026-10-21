import {
  ExtensionCommandContext,
  ExtensionContext,
  ToolCallEvent,
  getAgentDir,
} from "@earendil-works/pi-coding-agent";
import { execFile } from "node:child_process";

import { classifyCommand } from "../core/classifiers/shell-classifier";
import { resolveToolLevel } from "../core/classifiers/tool-classifier";
import type { Classification, PermissionState } from "../core/interfaces";
import { SettingsService } from "../core/settings";
import type { PermissionLevel, PermissionMode } from "../core/types";
import { LEVELS, LEVEL_INDEX, PERMISSION_MODES } from "../core/types";
import { PermissionStrategy } from "./interfaces";
import { handleConfigSubcommand } from "./internal/commands";
import { initializeSessionState } from "./internal/events";
import type { McpToolInput } from "./internal/mcp-input";
import { parseMcpInput } from "./internal/mcp-input";
import { classifyAndCheck } from "./internal/tool-permission";

/**
 * Abstract base class that owns the shared permission algorithm.
 *
 * Concrete strategies only implement the abstract presentation hooks.
 */
export abstract class BasePermissionStrategy implements PermissionStrategy {
  public readonly state: PermissionState;
  protected readonly settingsService: SettingsService;
  protected readonly execFileFn: (
    file: string,
    args: readonly string[],
    cb: (err: Error | null, stdout: string, stderr: string) => void,
  ) => void;

  /**
   * Create a BasePermissionStrategy with optional overrides for testing.
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
    this.settingsService =
      settingsService ?? new SettingsService(getAgentDir());
    this.execFileFn = execFileFn ?? execFile;
    this.state = this.createInitialState();
  }

  // ── State ────────────────────────────────────────────────────────

  /**
   * Create a fresh permission state with defaults and global overrides.
   *
   * @returns The initialized PermissionState.
   */
  createInitialState(): PermissionState {
    const state: PermissionState = {
      currentLevel: "minimal",
      isSessionOnly: false,
      permissionMode: "ask",
      isModeSessionOnly: false,
    };

    initializeSessionState(state, this.settingsService);
    return state;
  }

  /**
   * Set the permission level, optionally persisting globally.
   *
   * @param level - The permission level to set.
   * @param saveGlobally - Whether to persist globally.
   * @param _ctx - Extension context (unused, kept for override compatibility).
   */
  setLevel(
    level: PermissionLevel,
    saveGlobally: boolean,
    _ctx: ExtensionContext,
  ): void {
    this.state.currentLevel = level;
    this.state.isSessionOnly = !saveGlobally;
    if (saveGlobally) {
      this.settingsService.saveGlobalPermissionLevel(level);
    }
  }

  /**
   * Set the permission mode, optionally persisting globally.
   *
   * @param mode - The permission mode to set.
   * @param saveGlobally - Whether to persist globally.
   */
  setMode(mode: PermissionMode, saveGlobally: boolean): void {
    this.state.permissionMode = mode;
    this.state.isModeSessionOnly = !saveGlobally;
    if (saveGlobally) {
      this.settingsService.saveGlobalPermissionMode(mode);
    }
  }

  // ── Session ──────────────────────────────────────────────────────

  /**
   * Handle session start: initialize state and delegate to the presentation hook.
   *
   * @param ctx - Extension context.
   */
  handleSessionStart(ctx: ExtensionContext): void {
    initializeSessionState(this.state, this.settingsService);
    this.onSessionStart(ctx);
  }

  /** No-op default. Override in subclasses for session-start notifications. */
  protected onSessionStart(_ctx: ExtensionContext): void {}

  // ── Tool handlers ────────────────────────────────────────────────

  protected abstract onDangerous(
    command: string,
    ctx: ExtensionContext,
  ): Promise<{ block: true; reason: string } | undefined>;

  protected abstract onRequest(
    requiredLevel: PermissionLevel,
    message: string,
    details: string,
    ctx: ExtensionContext,
  ): Promise<{ block: true; reason: string } | undefined>;

  /** No-op default. Override in subclasses for MCP-allowed notifications. */
  protected onMcpAllowed(_toolName: string, _ctx: ExtensionContext): void {}

  /**
   * Classify and handle a bash tool call.
   *
   * @param command - The shell command to classify.
   * @param ctx - Extension context.
   * @returns Block result if denied, undefined to allow.
   */
  async handleBashToolCall(
    command: string,
    ctx: ExtensionContext,
  ): Promise<{ block: true; reason: string } | undefined> {
    if (this.state.currentLevel === "bypassed") return undefined;

    const classification = classifyCommand(command, this.settingsService);

    if (classification.dangerous) {
      return this.onDangerous(command, ctx);
    }

    return this.onRequest(
      classification.level,
      `$ ${command}`,
      `Command: ${command}`,
      ctx,
    );
  }

  /**
   * Classify and handle an MCP tool call.
   *
   * @param input - The MCP tool input.
   * @param ctx - Extension context.
   * @returns Block result if denied, undefined to allow.
   */
  async handleMcpToolCall(
    input: McpToolInput,
    ctx: ExtensionContext,
  ): Promise<{ block: true; reason: string } | undefined> {
    const config = this.settingsService.getPermissionConfig();
    const { targetTool, requiredLevel, dangerous } = parseMcpInput(
      input,
      config.mcp,
    );

    if (dangerous) {
      return this.onDangerous(`MCP: ${targetTool}`, ctx);
    }

    if (LEVEL_INDEX[this.state.currentLevel] >= LEVEL_INDEX[requiredLevel]) {
      this.onMcpAllowed(targetTool, ctx);
      return undefined;
    }

    return this.onRequest(
      requiredLevel,
      `MCP tool wants to call: ${targetTool}`,
      `MCP tool "${targetTool}"`,
      ctx,
    );
  }

  /**
   * Classify and handle a write/edit tool call.
   *
   * @param toolName - The tool name ("write" or "edit").
   * @param filePath - The file path being written/edited.
   * @param ctx - Extension context.
   * @returns Block result if denied, undefined to allow.
   */
  async handleWriteToolCall(
    toolName: string,
    filePath: string,
    ctx: ExtensionContext,
  ): Promise<{ block: true; reason: string } | undefined> {
    if (this.state.currentLevel === "bypassed") return undefined;

    const config = this.settingsService.getPermissionConfig();
    const classification = resolveToolLevel(toolName, config.tools);
    const action = toolName === "write" ? "Write" : "Edit";

    return this.checkAndHandleTool(
      classification,
      `${toolName}: ${filePath}`,
      `${action} ${filePath}`,
      action,
      ctx,
    );
  }

  /**
   * Route a tool call event to the appropriate handler.
   *
   * @param event - The tool call event.
   * @param ctx - Extension context.
   * @returns Block result if denied, undefined to allow.
   */
  async handleToolCall(
    event: ToolCallEvent,
    ctx: ExtensionContext,
  ): Promise<{ block: true; reason: string } | undefined> {
    if (event.toolName === "bash") {
      return this.handleBashToolCall(event.input.command as string, ctx);
    }

    if (event.toolName === "mcp") {
      return this.handleMcpToolCall(event.input, ctx);
    }

    if (["write", "edit"].includes(event.toolName)) {
      const input = event.input as { path: string };
      return this.handleWriteToolCall(event.toolName, input.path, ctx);
    }

    // Fallback: all other tools (read, ls, grep, find, unknown)
    const config = this.settingsService.getPermissionConfig();
    const classification = resolveToolLevel(event.toolName, config.tools);

    return this.checkAndHandleTool(
      classification,
      event.toolName,
      `Tool: ${event.toolName}`,
      `Tool call: ${event.toolName}`,
      ctx,
    );
  }

  /**
   * Core decision tree for tool permission checks.
   *
   * @param classification - The tool classification, or null for unknown.
   * @param toolName - The tool name for messaging.
   * @param message - Short message for the user.
   * @param details - Detailed description for the user.
   * @param ctx - Extension context.
   * @returns Block result if denied, undefined to allow.
   */
  protected async checkAndHandleTool(
    classification: Classification | null,
    toolName: string,
    message: string,
    details: string,
    ctx: ExtensionContext,
  ): Promise<{ block: true; reason: string } | undefined> {
    const result = classifyAndCheck(this.state, classification);

    if (result.blocked) {
      if (result.reason === "dangerous") {
        return this.onDangerous(toolName, ctx);
      }
      // Unknown tool below high level — prompt to allow upgrade
      return this.onRequest("high", message, details, ctx);
    }

    const level = result.classification?.level ?? "high";
    return this.onRequest(level, message, details, ctx);
  }

  // ── Command handlers ─────────────────────────────────────────────

  protected abstract onViewLevel(ctx: ExtensionCommandContext): Promise<void>;
  protected abstract onSetLevel(
    level: PermissionLevel,
    ctx: ExtensionCommandContext,
  ): Promise<void>;
  protected abstract onViewMode(ctx: ExtensionCommandContext): Promise<void>;
  protected abstract onSetMode(
    mode: PermissionMode,
    ctx: ExtensionCommandContext,
  ): Promise<void>;
  /** No-op default. Override in subclasses for settings UI. */
  protected async onSettings(_ctx: ExtensionCommandContext): Promise<void> {}

  /** Returns the prefix for no-UI messages (empty string for UI). */
  protected configPrefix(): string {
    return "";
  }

  /**
   * Handle the /permission command with subcommand routing.
   *
   * @param args - The command arguments.
   * @param ctx - Extension command context.
   */
  async handlePermissionCommand(
    args: string,
    ctx: ExtensionCommandContext,
  ): Promise<void> {
    const arg = args.trim().toLowerCase();

    // config subcommand
    if (arg === "config" || arg.startsWith("config ")) {
      const configArgs = arg.replace(/^config\s*/, "");
      await handleConfigSubcommand(configArgs, ctx, this.configPrefix(), {
        settingsService: this.settingsService,
      });
      return;
    }

    // settings subcommand
    if (arg === "settings") {
      await this.onSettings(ctx);
      return;
    }

    // Level specified directly
    if (arg && LEVELS.includes(arg as PermissionLevel)) {
      const newLevel = arg as PermissionLevel;
      await this.onSetLevel(newLevel, ctx);
      return;
    }

    // No args: show current level
    await this.onViewLevel(ctx);
  }

  /**
   * Handle the /permission-mode command.
   *
   * @param args - The command arguments.
   * @param ctx - Extension command context.
   */
  async handlePermissionModeCommand(
    args: string,
    ctx: ExtensionCommandContext,
  ): Promise<void> {
    const arg = args.trim().toLowerCase();

    // Mode specified directly
    if (arg && PERMISSION_MODES.includes(arg as PermissionMode)) {
      const newMode = arg as PermissionMode;
      await this.onSetMode(newMode, ctx);
      return;
    }

    // No args: show current mode
    await this.onViewMode(ctx);
  }
}
