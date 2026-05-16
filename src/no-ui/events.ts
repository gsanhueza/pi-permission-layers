/**
 * Non-interactive event handlers
 */

import { ToolCallEvent } from "@earendil-works/pi-coding-agent";
import type { PermissionState } from "../core/interfaces";
import { initializeSessionState } from "../shared/events";
import { isKnownReadTool } from "../shared/tools";
import {
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

export const handleToolCall = async (
  event: ToolCallEvent,
  state: PermissionState,
): Promise<any> => {
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

  if (!isKnownReadTool(event.toolName)) {
    return {
      block: true,
      reason: `⚠️ Unknown tool "${event.toolName}" requires High permission`,
    };
  }

  return undefined;
};
