import {
  ExtensionCommandContext,
  ExtensionContext,
  ToolCallEvent,
} from "@earendil-works/pi-coding-agent";
import { classifyCommand } from "../core/classifiers/shell-classifier";
import { resolveToolLevel } from "../core/classifiers/tool-classifier";
import { getCachedConfig } from "../core/config";
import type { Classification, PermissionState } from "../core/interfaces";
import {
  saveGlobalPermissionLevel,
  saveGlobalPermissionMode,
} from "../core/settings";
import type { PermissionLevel, PermissionMode } from "../core/types";
import { LEVELS, LEVEL_INDEX, PERMISSION_MODES } from "../core/types";
import { handleConfigSubcommand } from "../shared/commands";
import { initializeSessionState } from "../shared/events";
import type { McpToolInput } from "../shared/mcp-input";
import { parseMcpInput } from "../shared/mcp-input";
import { classifyAndCheck } from "../shared/tool-permission";
import { PermissionStrategy } from "./interfaces";

/**
 * Abstract base class that owns the shared permission algorithm.
 *
 * Concrete strategies only implement the abstract presentation hooks.
 */
export abstract class BasePermissionStrategy implements PermissionStrategy {
  // ── State ────────────────────────────────────────────────────────

  createInitialState(): PermissionState {
    const state: PermissionState = {
      currentLevel: "minimal",
      isSessionOnly: false,
      permissionMode: "ask",
      isModeSessionOnly: false,
    };
    initializeSessionState(state);
    return state;
  }

  setLevel(
    state: PermissionState,
    level: PermissionLevel,
    saveGlobally: boolean,
    _ctx: ExtensionContext,
  ): void {
    state.currentLevel = level;
    state.isSessionOnly = !saveGlobally;
    if (saveGlobally) {
      saveGlobalPermissionLevel(level);
    }
  }

  setMode(
    state: PermissionState,
    mode: PermissionMode,
    saveGlobally: boolean,
  ): void {
    state.permissionMode = mode;
    state.isModeSessionOnly = !saveGlobally;
    if (saveGlobally) {
      saveGlobalPermissionMode(mode);
    }
  }

  // ── Session ──────────────────────────────────────────────────────

  handleSessionStart(state: PermissionState, ctx: ExtensionContext): void {
    initializeSessionState(state);
    this.onSessionStart(state, ctx);
  }

  protected abstract onSessionStart(
    state: PermissionState,
    ctx: ExtensionContext,
  ): void;

  // ── Tool handlers ────────────────────────────────────────────────

  protected abstract onDangerous(
    command: string,
    state: PermissionState,
    ctx: ExtensionContext,
  ): Promise<{ block: true; reason: string } | undefined>;

  protected abstract onRequest(
    state: PermissionState,
    requiredLevel: PermissionLevel,
    message: string,
    details: string,
    ctx: ExtensionContext,
  ): Promise<{ block: true; reason: string } | undefined>;

  protected abstract onMcpAllowed(
    toolName: string,
    ctx: ExtensionContext,
  ): void;

  async handleBashToolCall(
    state: PermissionState,
    command: string,
    ctx: ExtensionContext,
  ): Promise<{ block: true; reason: string } | undefined> {
    if (state.currentLevel === "bypassed") return undefined;

    const classification = classifyCommand(command);

    if (classification.dangerous) {
      return this.onDangerous(command, state, ctx);
    }

    return this.onRequest(
      state,
      classification.level,
      `$ ${command}`,
      `Command: ${command}`,
      ctx,
    );
  }

  async handleMcpToolCall(
    state: PermissionState,
    input: McpToolInput,
    ctx: ExtensionContext,
  ): Promise<{ block: true; reason: string } | undefined> {
    const config = getCachedConfig();
    const { targetTool, requiredLevel, dangerous } = parseMcpInput(
      input,
      config.mcp,
    );

    if (dangerous) {
      return this.onDangerous(`MCP: ${targetTool}`, state, ctx);
    }

    if (LEVEL_INDEX[state.currentLevel] >= LEVEL_INDEX[requiredLevel]) {
      this.onMcpAllowed(targetTool, ctx);
      return undefined;
    }

    return this.onRequest(
      state,
      requiredLevel,
      `MCP tool wants to call: ${targetTool}`,
      `MCP tool "${targetTool}"`,
      ctx,
    );
  }

  async handleWriteToolCall(
    state: PermissionState,
    toolName: string,
    filePath: string,
    ctx: ExtensionContext,
  ): Promise<{ block: true; reason: string } | undefined> {
    if (state.currentLevel === "bypassed") return undefined;

    const config = getCachedConfig();
    const classification = resolveToolLevel(toolName, config.tools);
    const action = toolName === "write" ? "Write" : "Edit";

    return this.checkAndHandleTool(
      state,
      classification,
      `${toolName}: ${filePath}`,
      `${action} ${filePath}`,
      action,
      ctx,
    );
  }

  async handleToolCall(
    event: ToolCallEvent,
    state: PermissionState,
    ctx: ExtensionContext,
  ): Promise<{ block: true; reason: string } | undefined> {
    if (event.toolName === "bash") {
      return this.handleBashToolCall(state, event.input.command as string, ctx);
    }

    if (event.toolName === "mcp") {
      return this.handleMcpToolCall(state, event.input, ctx);
    }

    if (["write", "edit"].includes(event.toolName)) {
      const input = event.input as { path: string };
      return this.handleWriteToolCall(state, event.toolName, input.path, ctx);
    }

    // Fallback: all other tools (read, ls, grep, find, unknown)
    const config = getCachedConfig();
    const classification = resolveToolLevel(event.toolName, config.tools);

    return this.checkAndHandleTool(
      state,
      classification,
      event.toolName,
      `Tool: ${event.toolName}`,
      `Tool call: ${event.toolName}`,
      ctx,
    );
  }

  protected async checkAndHandleTool(
    state: PermissionState,
    classification: Classification | null,
    toolName: string,
    message: string,
    details: string,
    ctx: ExtensionContext,
  ): Promise<{ block: true; reason: string } | undefined> {
    const result = classifyAndCheck(state, classification);

    if (result.blocked) {
      if (result.reason === "dangerous") {
        return this.onDangerous(toolName, state, ctx);
      }
      return {
        block: true,
        reason: `[pi-permission-layers] Unknown tool "${toolName}" requires High permission`,
      };
    }

    return this.onRequest(
      state,
      result.classification!.level,
      message,
      details,
      ctx,
    );
  }

  // ── Command handlers ─────────────────────────────────────────────

  protected abstract onViewLevel(
    state: PermissionState,
    ctx: ExtensionCommandContext,
  ): Promise<void>;
  protected abstract onSetLevel(
    level: PermissionLevel,
    state: PermissionState,
    ctx: ExtensionCommandContext,
  ): Promise<void>;
  protected abstract onViewMode(
    state: PermissionState,
    ctx: ExtensionCommandContext,
  ): Promise<void>;
  protected abstract onSetMode(
    mode: PermissionMode,
    state: PermissionState,
    ctx: ExtensionCommandContext,
  ): Promise<void>;
  protected abstract onSettings(ctx: ExtensionCommandContext): Promise<void>;

  /** Returns the prefix for no-UI messages (empty string for UI). */
  protected configPrefix(): string {
    return "";
  }

  async handlePermissionCommand(
    state: PermissionState,
    args: string,
    ctx: ExtensionCommandContext,
  ): Promise<void> {
    const arg = args.trim().toLowerCase();

    // config subcommand
    if (arg === "config" || arg.startsWith("config ")) {
      const configArgs = arg.replace(/^config\s*/, "");
      await handleConfigSubcommand(configArgs, ctx, this.configPrefix());
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
      await this.onSetLevel(newLevel, state, ctx);
      return;
    }

    // No args: show current level
    await this.onViewLevel(state, ctx);
  }

  async handlePermissionModeCommand(
    state: PermissionState,
    args: string,
    ctx: ExtensionCommandContext,
  ): Promise<void> {
    const arg = args.trim().toLowerCase();

    // Mode specified directly
    if (arg && PERMISSION_MODES.includes(arg as PermissionMode)) {
      const newMode = arg as PermissionMode;
      await this.onSetMode(newMode, state, ctx);
      return;
    }

    // No args: show current mode
    await this.onViewMode(state, ctx);
  }
}
