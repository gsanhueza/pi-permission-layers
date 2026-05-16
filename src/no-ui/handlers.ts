/**
 * Non-interactive tool call handlers
 */

import { classifyCommand } from "../core/classifier";
import type { PermissionState, WriteToolCallOptions } from "../core/interfaces";
import type { PermissionLevel } from "../core/types";
import { LEVEL_INDEX, LEVEL_INFO } from "../core/types";
import { parseMcpInput } from "../shared/tools";

// ============================================================================
// DANGEROUS COMMAND HANDLER
// ============================================================================

export const handleDangerousCommand = (
  command: string,
): { block: true; reason: string } => {
  return {
    block: true,
    reason: `Dangerous command requires confirmation: ${command}
User can re-run with: PI_PERMISSION_LEVEL=bypassed pi -p "..."`,
  };
};

// ============================================================================
// PERMISSION REQUEST HELPER
// ============================================================================

interface RequestPermissionNoUIOpts {
  state: PermissionState;
  message: string;
  requiredLevel: PermissionLevel;
  envVarHint: string;
}

export const requestPermission = (
  opts: RequestPermissionNoUIOpts,
): { block: true; reason: string } | undefined => {
  const { state, message, requiredLevel, envVarHint } = opts;

  if (state.currentLevel === "bypassed") return undefined;

  const requiredIndex = LEVEL_INDEX[requiredLevel];
  const currentIndex = LEVEL_INDEX[state.currentLevel];

  if (currentIndex >= requiredIndex) return undefined;

  return {
    block: true,
    reason: `${message}
Blocked by permission (${state.currentLevel}). Allowed at this level: ${LEVEL_INFO[state.currentLevel].desc}
User can re-run with: PI_PERMISSION_LEVEL=${requiredLevel} ${envVarHint}`,
  };
};

// ============================================================================
// BASH TOOL HANDLER
// ============================================================================

export const handleBashToolCall = (
  state: PermissionState,
  command: string,
): { block: true; reason: string } | undefined => {
  if (state.currentLevel === "bypassed") return undefined;

  const classification = classifyCommand(command);

  if (classification.dangerous) {
    return handleDangerousCommand(command);
  }

  return requestPermission({
    state,
    message: `$ ${command}`,
    requiredLevel: classification.level,
    envVarHint: `pi -p "..."`,
  });
};

// ============================================================================
// MCP TOOL HANDLER
// ============================================================================

export const handleMcpToolCall = (
  state: PermissionState,
  input: Record<string, any>,
): { block: true; reason: string } => {
  const { targetTool, requiredLevel } = parseMcpInput(input);

  return {
    block: true,
    reason: `MCP tool "${targetTool}" blocked by permission (${state.currentLevel}). Allowed at this level: ${LEVEL_INFO[state.currentLevel].desc}
User can re-run with: PI_PERMISSION_LEVEL=${requiredLevel} pi -p "..."`,
  };
};

// ============================================================================
// WRITE/EDIT TOOL HANDLER
// ============================================================================

export const handleWriteToolCall = (
  opts: Omit<WriteToolCallOptions, "ctx">,
): { block: true; reason: string } | undefined => {
  const { state, toolName, filePath } = opts;

  if (state.currentLevel === "bypassed") return undefined;
  if (LEVEL_INDEX[state.currentLevel] >= LEVEL_INDEX["low"]) return undefined;

  const action = toolName === "write" ? "Write" : "Edit";

  return requestPermission({
    state,
    message: `Requires Low: ${action} ${filePath}`,
    requiredLevel: "low",
    envVarHint: 'pi -p "..."',
  });
};
