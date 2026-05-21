/**
 * Non-interactive event handlers
 */

import { ToolCallEvent } from "@earendil-works/pi-coding-agent";
import type { PermissionState } from "../core/interfaces";
import { initializeSessionState } from "../shared/events";
import { isKnownReadTool } from "../shared/tools";
import { loadPermissionConfig } from "../core/settings";
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

  const config = loadPermissionConfig();
  if (!isKnownReadTool(event.toolName, config)) {
    return {
      block: true,
      reason: `⚠️ [pi-permission-layers] Unknown tool "${event.toolName}" requires High permission; refer to pi-permission-layers/docs/architecture.md for whitelist information`,
    };
  }

  return undefined;
};
