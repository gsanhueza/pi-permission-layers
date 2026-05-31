import { resolveToolLevel } from "../core/tool-classifier";
import { getCachedConfig } from "../core/tools";
import { LEVEL_INDEX } from "../core/types";
import { initializeSessionState } from "../shared/events";
import {
  handleBashToolCall,
  handleDangerousCommand,
  handleMcpToolCall,
  handleWriteToolCall,
  requestPermission,
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

type ToolCallResult = { block: true; reason: string } | undefined;

export const handleToolCall = async (
  event: ToolCallEvent,
  ctx: ExtensionContext,
  state: PermissionState,
): Promise<ToolCallResult> => {
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

  // Fallback: all other tools (read, ls, grep, find, or unknown)
  const config = getCachedConfig();
  const classification = resolveToolLevel(event.toolName, config.tools);

  if (classification === null) {
    return {
      block: true,
      reason: `⚠️ Unknown tool "${event.toolName}" requires High permission`,
    };
  }

  if (classification.dangerous) {
    return handleDangerousCommand(event.toolName, state, ctx);
  }

  if (LEVEL_INDEX[state.currentLevel] >= LEVEL_INDEX[classification.level]) {
    return undefined;
  }

  return requestPermission({
    state,
    message: `Tool: ${event.toolName}`,
    requiredLevel: classification.level,
    details: `Tool call: ${event.toolName}`,
    notifyTitle: "Permission Required",
    ctx,
  });
};
