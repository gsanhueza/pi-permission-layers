/**
 * Non-interactive event handlers
 */

import { ToolCallEvent } from "@earendil-works/pi-coding-agent";
import { resolveToolLevel } from "../core/classifiers/tool-classifier";
import { getCachedConfig } from "../core/config";
import type { PermissionState } from "../core/interfaces";
import { initializeSessionState } from "../shared/events";
import {
  checkToolPermission,
  handleBashToolCall,
  handleMcpToolCall,
  handleWriteToolCall,
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

  return checkToolPermission(
    state,
    classification,
    event.toolName,
    () => `Tool: ${event.toolName}`,
  );
};
