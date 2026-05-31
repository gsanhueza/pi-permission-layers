/**
 * Interactive tool call handlers - bash, mcp, write/edit, unknown tools
 */

import { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { classifyCommand } from "../core/classifier";
import type { PermissionState, WriteToolCallOptions } from "../core/interfaces";
import type { PermissionLevel } from "../core/types";
import { LEVEL_INDEX, LEVEL_INFO } from "../core/types";
import { getCachedConfig } from "../core/tools";
import { resolveToolLevel } from "../core/tool-classifier";
import type { McpToolInput } from "../shared/tools";
import { parseMcpInput } from "../shared/tools";
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

  if (state.currentLevel === "bypassed") return undefined;

  const requiredIndex = LEVEL_INDEX[requiredLevel];
  const currentIndex = LEVEL_INDEX[state.currentLevel];

  if (currentIndex >= requiredIndex) return undefined;

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
    ctx.ui.notify(`Permission → ${requiredInfo.label} (session only)`, "info");
    return undefined;
  }

  return {
    block: true,
    reason: "Cancelled by the user. Do not attempt to repeat or circumvent.",
  };
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
  const { targetTool, requiredLevel, dangerous } = parseMcpInput(input, config.mcp);

  // Dangerous tools always require confirmation
  if (dangerous) {
    return handleDangerousCommand(`MCP: ${targetTool}`, state, ctx);
  }

  if (LEVEL_INDEX[state.currentLevel] >= LEVEL_INDEX[requiredLevel]) {
    ctx.ui.notify(`MCP tool: ${targetTool}`, "info");
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

  // Fallback to default low for known tools, or block if unknown
  if (!classification) {
    return {
      block: true,
      reason: `Unknown tool "${toolName}" requires High permission`,
    };
  }

  // Dangerous tools always require confirmation
  if (classification.dangerous) {
    return handleDangerousCommand(`${toolName}: ${filePath}`, state, ctx);
  }

  if (LEVEL_INDEX[state.currentLevel] >= LEVEL_INDEX[classification.level]) {
    return undefined;
  }

  const action = toolName === "write" ? "Write" : "Edit";

  return requestPermission({
    state,
    message: `${action} ${filePath}`,
    requiredLevel: classification.level,
    details: `${action}`,
    notifyTitle: "Permission Required",
    ctx,
  });
};
