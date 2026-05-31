/**
 * Non-interactive event handlers
 */

import { ToolCallEvent } from "@earendil-works/pi-coding-agent";
import type { PermissionState } from "../core/interfaces";
import { resolveToolLevel } from "../core/tool-classifier";
import { getCachedConfig } from "../core/tools";
import { LEVEL_INDEX } from "../core/types";
import { initializeSessionState } from "../shared/events";
import {
  handleBashToolCall,
  handleMcpToolCall,
  handleWriteToolCall,
  requestPermission,
} from "./handlers";

// ============================================================================
// SESSION START
// ============================================================================

export const handleSessionStart = (state: PermissionState): void => {
  initializeSessionState(state);
};

// ============================================================================
// TOOL CALL HANDLER
// ============================================================================

type ToolCallResult = { block: true; reason: string } | undefined;

export const handleToolCall = async (
  event: ToolCallEvent,
  state: PermissionState,
): Promise<ToolCallResult> => {
  if (event.toolName === "bash") {
    return handleBashToolCall(state, event.input.command as string);
  }

  if (event.toolName === "mcp") {
    return handleMcpToolCall(state, event.input);
  }

  if (["write", "edit"].includes(event.toolName)) {
    const input = event.input as { path: string };
    return handleWriteToolCall({
      state,
      toolName: event.toolName,
      filePath: input.path,
    });
  }

  // Fallback: all other tools (read, ls, grep, find, or unknown)
  const config = getCachedConfig();
  const classification = resolveToolLevel(event.toolName, config.tools);

  if (classification === null) {
    return {
      block: true,
      reason: `⚠️ Unknown tool "${event.toolName}" requires High permission`,
    };
  }

  if (LEVEL_INDEX[state.currentLevel] >= LEVEL_INDEX[classification.level]) {
    return undefined;
  }

  return requestPermission({
    state,
    message: `Tool: ${event.toolName}`,
    requiredLevel: classification.level,
    envVarHint: 'pi -p "..."',
  });
};
