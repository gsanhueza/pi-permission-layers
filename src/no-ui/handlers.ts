/**
 * Non-interactive tool call handlers
 */

import { classifyCommand } from "../core/classifiers/shell-classifier";
import { resolveToolLevel } from "../core/classifiers/tool-classifier";
import { getCachedConfig } from "../core/config";
import type {
  Classification,
  PermissionState,
  WriteToolCallOptions,
} from "../core/interfaces";
import type { PermissionLevel } from "../core/types";
import { LEVEL_INFO } from "../core/types";
import type { McpToolInput } from "../shared/mcp-input";
import { parseMcpInput } from "../shared/mcp-input";
import { checkPermission } from "../shared/permission-check";
import { classifyAndCheck } from "../shared/tool-permission";

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

  if (checkPermission(state, requiredLevel)) return undefined;

  return {
    block: true,
    reason: `${message}
Blocked by permission (${state.currentLevel}). Allowed at this level: ${LEVEL_INFO[state.currentLevel].desc}
User can re-run with: PI_PERMISSION_LEVEL=${requiredLevel} ${envVarHint}`,
  };
};

// ============================================================================
// TOOL PERMISSION CHECKER (no-ui)
// ============================================================================

/**
 * Check tool permission using the shared decision tree, then request
 * permission with no-ui specific formatting.
 */
export const checkToolPermission = (
  state: PermissionState,
  classification: Classification | null,
  toolName: string,
  messageBuilder: (c: Classification) => string,
): { block: true; reason: string } | undefined => {
  const result = classifyAndCheck(state, classification);

  if (result.blocked) {
    if (result.reason === "dangerous") {
      return handleDangerousCommand(toolName);
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
    envVarHint: 'pi -p "..."',
  });
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
  input: McpToolInput,
): { block: true; reason: string } => {
  const config = getCachedConfig();
  const { targetTool, requiredLevel, dangerous } = parseMcpInput(
    input,
    config.mcp,
  );

  const levelHint = dangerous ? "high (dangerous)" : requiredLevel;

  return {
    block: true,
    reason: `MCP tool "${targetTool}" blocked by permission (${state.currentLevel}). Allowed at this level: ${LEVEL_INFO[state.currentLevel].desc}
User can re-run with: PI_PERMISSION_LEVEL=${levelHint} pi -p "..."`,
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

  const config = getCachedConfig();
  const classification = resolveToolLevel(toolName, config.tools);

  const action = toolName === "write" ? "Write" : "Edit";

  return checkToolPermission(
    state,
    classification,
    `${toolName}: ${filePath}`,
    (c) => `Requires ${c.level}: ${action} ${filePath}`,
  );
};
