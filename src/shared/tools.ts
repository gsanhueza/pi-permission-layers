/**
 * Shared tool detection logic used by both UI and no-UI handlers.
 */

import type { McpPermissionConfig } from "../core/interfaces";
import type { PermissionLevel } from "../core/types";
import { resolveMcpLevel, resolveToolLevel } from "../core/tool-classifier";

// ============================================================================
// KNOWN READ-ONLY TOOLS
// ============================================================================

export const isKnownReadTool = (toolName: string): boolean => {
  const classification = resolveToolLevel(toolName, undefined);
  return classification !== null && classification.level === "minimal";
};

// ============================================================================
// MCP TOOL INFO
// ============================================================================

export interface McpToolInfo {
  targetTool: string;
  mode: string;
  requiredLevel: PermissionLevel;
}

export interface McpToolInput {
  tool?: string;
  connect?: string;
  describe?: string;
  search?: string;
  server?: string;
  action?: string;
  [key: string]: unknown;
}

export const parseMcpInput = (
  input: McpToolInput,
  mcpConfig?: McpPermissionConfig,
): McpToolInfo => {
  let targetTool: string;
  let mode: string;

  if (input.tool) {
    targetTool = input.tool;
    mode = "call";
  } else if (input.connect) {
    targetTool = `connect(${input.connect})`;
    mode = "connect";
  } else if (input.describe) {
    targetTool = `describe(${input.describe})`;
    mode = "describe";
  } else if (input.search) {
    targetTool = `search(${input.search})`;
    mode = "search";
  } else if (input.server) {
    targetTool = `list(${input.server})`;
    mode = "list";
  } else if (input.action) {
    targetTool = `action(${input.action})`;
    mode = "action";
  } else {
    targetTool = "status";
    mode = "status";
  }

  // Use config-based classification
  const classification = resolveMcpLevel(targetTool, mode, mcpConfig);

  let requiredLevel: PermissionLevel;
  if (classification) {
    if (classification.dangerous) {
      requiredLevel = "high";
    } else {
      requiredLevel = classification.level;
    }
  } else {
    // Not found in config or defaults — medium (current default for unknown MCP tools)
    requiredLevel = "medium";
  }

  return { targetTool, mode, requiredLevel };
};
