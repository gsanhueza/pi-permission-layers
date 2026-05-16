/**
 * Interactive tool call handlers - bash, mcp, write/edit, unknown tools
 */

import { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { classifyCommand } from "../core/classifier";
import type { PermissionState, WriteToolCallOptions } from "../core/interfaces";
import type { PermissionLevel } from "../core/types";
import { LEVEL_INDEX, LEVEL_INFO } from "../core/types";
import { parseMcpInput, truncate } from "../shared/tools";
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

  const choice = await ctx.ui.select(`⚠️ Dangerous: $ ${truncate(command)}`, [
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

  await notifySystem(
    notifyTitle,
    `${details} requires ${requiredInfo.label} level (current: ${LEVEL_INFO[state.currentLevel].label})`,
  );

  if (state.permissionMode === "block") {
    return {
      block: true,
      reason: `${message}
Blocked by permission (${state.currentLevel}, mode: block). Requires ${requiredInfo.label}.
Use /permission ${requiredLevel} or /permission-mode ask to enable prompts.`,
    };
  }

  const promptTitle = `${message}  [requires ${requiredInfo.label}]`;
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

  const displayCmd = truncate(command);

  return requestPermission({
    state,
    message: `$ ${displayCmd}`,
    requiredLevel: classification.level,
    details: `Command: ${displayCmd}`,
    notifyTitle: "Permission Required",
    ctx,
  });
};

// ============================================================================
// MCP TOOL HANDLER
// ============================================================================

export const handleMcpToolCall = async (
  state: PermissionState,
  input: Record<string, any>,
  ctx: ExtensionContext,
): Promise<{ block: true; reason: string } | undefined> => {
  const { targetTool, requiredLevel } = parseMcpInput(input);

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
  if (LEVEL_INDEX[state.currentLevel] >= LEVEL_INDEX["low"]) return undefined;

  const action = toolName === "write" ? "Write" : "Edit";

  return requestPermission({
    state,
    message: `Requires Low: ${action} ${filePath}`,
    requiredLevel: "low",
    details: `${action}`,
    notifyTitle: "Permission Required",
    ctx,
  });
};
