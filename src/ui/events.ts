import { resolveToolLevel } from "../core/classifiers/tool-classifier";
import { getCachedConfig } from "../core/config";
import { notify } from "../shared/commands";
import { initializeSessionState } from "../shared/events";
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
import { checkToolPermission } from "../ui/handlers";

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
    notify(ctx, "⚠️ Permission bypassed - all checks disabled!", "warning");
  } else if (!isQuietMode(ctx)) {
    notify(
      ctx,
      `Permission: ${getStatusText(state.currentLevel)} (use /permission to change)`,
    );
  }
  if (state.permissionMode === "block") {
    notify(ctx, "Permission mode: Block (use /permission-mode to change)");
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

  return checkToolPermission({
    state,
    classification,
    toolName: event.toolName,
    messageBuilder: () => `Tool: ${event.toolName}`,
    details: `Tool call: ${event.toolName}`,
    notifyTitle: "Permission Required",
    ctx,
  });
};
