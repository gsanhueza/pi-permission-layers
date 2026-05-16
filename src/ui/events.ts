import { initializeSessionState } from "../shared/events";
import { isKnownReadTool } from "../shared/tools";
import {
  handleBashToolCall,
  handleMcpToolCall,
  handleWriteToolCall,
} from "../ui/handlers";
import { getStatusText, isQuietMode } from "./ui";

import {
  ExtensionContext,
  ToolCallEvent,
} from "@earendil-works/pi-coding-agent";
import { PermissionState } from "../core/interfaces";

// ============================================================================
// SESSION START
// ============================================================================

export const handleSessionStart = (
  state: PermissionState,
  ctx: ExtensionContext,
): void => {
  initializeSessionState(state);

  if (ctx.ui?.setStatus) {
    ctx.ui.setStatus("authority", getStatusText(state.currentLevel));
  }
  if (state.currentLevel === "bypassed") {
    ctx.ui.notify("⚠️ Permission bypassed - all checks disabled!", "warning");
  } else if (!isQuietMode(ctx)) {
    ctx.ui.notify(
      `Permission: ${getStatusText(state.currentLevel)} (use /permission to change)`,
      "info",
    );
  }
  if (state.permissionMode === "block") {
    ctx.ui.notify(
      "Permission mode: Block (use /permission-mode to change)",
      "info",
    );
  }
};

// ============================================================================
// TOOL CALL DISPATCHER
// ============================================================================

export const handleToolCall = async (
  event: ToolCallEvent,
  ctx: ExtensionContext,
  state: PermissionState,
): Promise<any> => {
  if (event.toolName === "bash") {
    return handleBashToolCall(state, event.input.command as string, ctx);
  }

  if (event.toolName === "mcp") {
    return handleMcpToolCall(state, event.input, ctx);
  }

  if (["write", "edit"].includes(event.toolName)) {
    const input = event.input as { path: string };
    return handleWriteToolCall({
      state,
      toolName: event.toolName,
      filePath: input.path,
      ctx,
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
