/**
 * Interactive tool call handlers - bash, mcp, write/edit, unknown tools
 */

import { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { classifyCommand } from "../core/classifiers/shell-classifier";
import { resolveToolLevel } from "../core/classifiers/tool-classifier";
import { getCachedConfig } from "../core/config";
import type {
  Classification,
  PermissionState,
  WriteToolCallOptions,
} from "../core/interfaces";
import type { PermissionLevel } from "../core/types";
import { LEVEL_INDEX, LEVEL_INFO } from "../core/types";
import { notify } from "../shared/commands";
import type { McpToolInput } from "../shared/mcp-input";
import { parseMcpInput } from "../shared/mcp-input";
import { checkPermission } from "../shared/permission-check";
import { classifyAndCheck } from "../shared/tool-permission";
import { setLevel } from "./state";
import { notifySystem } from "./ui";

interface RequestPermissionUIOpts {
  state: PermissionState;
  message: string;
  requiredLevel: PermissionLevel;
  details: string;
  notifyTitle: string;
  ctx: ExtensionContext;
}

// ============================================================================
// DANGEROUS COMMAND HANDLER
// ============================================================================

export const handleDangerousCommand = async (
  command: string,
  state: PermissionState,
  ctx: ExtensionContext,
): Promise<{ block: true; reason: string } | undefined> => {
  await notifySystem("⚠️ Permission Required", `Dangerous command: ${command}`);

  if (state.permissionMode === "block") {
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
      reason: "Cancelled by the user. Do not attempt to repeat or circumvent.",
    };
  }
  return undefined;
};

// ============================================================================
// PERMISSION REQUEST HELPER
// ============================================================================

export const requestPermission = async (
  opts: RequestPermissionUIOpts,
): Promise<
  | {
      block: true;
      reason: string;
    }
  | undefined
> => {
  const { state, message, requiredLevel, details, notifyTitle, ctx } = opts;

  if (checkPermission(state, requiredLevel)) return undefined;

  const requiredInfo = LEVEL_INFO[requiredLevel];
  const currentInfo = LEVEL_INFO[state.currentLevel];

  // Send system notification
  const systemTitle = `${notifyTitle} (${requiredInfo.label})`;
  await notifySystem(
    systemTitle,
    `${details} \nCurrent level: ${currentInfo.label}`,
  );

  if (state.permissionMode === "block") {
    return {
      block: true,
      reason: `${message}
Blocked by permission (${state.currentLevel}, mode: block). Requires ${requiredInfo.label}.
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
    setLevel(state, requiredLevel, false, ctx);
    notify(ctx, `Permission → ${requiredInfo.label} (session only)`);
    return undefined;
  }

  return {
    block: true,
    reason: "Cancelled by the user. Do not attempt to repeat or circumvent.",
  };
};

// ============================================================================
// TOOL PERMISSION CHECKER (ui)
// ============================================================================

interface CheckToolPermissionOpts {
  state: PermissionState;
  classification: Classification | null;
  toolName: string;
  messageBuilder: (c: Classification) => string;
  details: string;
  notifyTitle: string;
  ctx: ExtensionContext;
}

/**
 * Check tool permission using the shared decision tree, then request
 * permission with ui-specific formatting.
 */
export const checkToolPermission = async (
  opts: CheckToolPermissionOpts,
): Promise<{ block: true; reason: string } | undefined> => {
  const {
    state,
    classification,
    toolName,
    messageBuilder,
    details,
    notifyTitle,
    ctx,
  } = opts;

  const result = classifyAndCheck(state, classification);

  if (result.blocked) {
    if (result.reason === "dangerous") {
      return handleDangerousCommand(toolName, state, ctx);
    }
    return {
      block: true,
      reason: `[pi-permission-layers] Unknown tool "${toolName}" requires High permission`,
    };
  }

  return requestPermission({
    state,
    message: messageBuilder(result.classification!),
    requiredLevel: result.classification!.level,
    details,
    notifyTitle,
    ctx,
  });
};

// ============================================================================
// BASH TOOL HANDLER
// ============================================================================

export const handleBashToolCall = async (
  state: PermissionState,
  command: string,
  ctx: ExtensionContext,
): Promise<{ block: true; reason: string } | undefined> => {
  if (state.currentLevel === "bypassed") return undefined;

  const classification = classifyCommand(command);

  if (classification.dangerous) {
    return handleDangerousCommand(command, state, ctx);
  }

  return requestPermission({
    state,
    message: `$ ${command}`,
    requiredLevel: classification.level,
    details: `Command: ${command}`,
    notifyTitle: "Permission Required",
    ctx,
  });
};

// ============================================================================
// MCP TOOL HANDLER
// ============================================================================

export const handleMcpToolCall = async (
  state: PermissionState,
  input: McpToolInput,
  ctx: ExtensionContext,
): Promise<{ block: true; reason: string } | undefined> => {
  const config = getCachedConfig();
  const { targetTool, requiredLevel, dangerous } = parseMcpInput(
    input,
    config.mcp,
  );

  // Dangerous tools always require confirmation
  if (dangerous) {
    return handleDangerousCommand(`MCP: ${targetTool}`, state, ctx);
  }

  if (LEVEL_INDEX[state.currentLevel] >= LEVEL_INDEX[requiredLevel]) {
    notify(ctx, `MCP tool: ${targetTool}`);
    return undefined;
  }

  return requestPermission({
    state,
    message: `MCP tool wants to call: ${targetTool}`,
    requiredLevel,
    details: `MCP tool "${targetTool}"`,
    notifyTitle: "MCP Tool Call",
    ctx,
  });
};

// ============================================================================
// WRITE/EDIT TOOL HANDLER
// ============================================================================

export const handleWriteToolCall = async (
  opts: Omit<WriteToolCallOptions, "ctx"> & { ctx: ExtensionContext },
): Promise<{ block: true; reason: string } | undefined> => {
  const { state, toolName, filePath, ctx } = opts;

  if (state.currentLevel === "bypassed") return undefined;

  const config = getCachedConfig();
  const classification = resolveToolLevel(toolName, config.tools);

  const action = toolName === "write" ? "Write" : "Edit";

  return checkToolPermission({
    state,
    classification,
    toolName: `${toolName}: ${filePath}`,
    messageBuilder: (c) => `${action} ${filePath}`,
    details: action,
    notifyTitle: "Permission Required",
    ctx,
  });
};
