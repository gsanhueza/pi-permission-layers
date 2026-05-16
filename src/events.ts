import {
  loadGlobalPermission,
  loadGlobalPermissionMode,
} from "./core/settings";
import type { PermissionLevel, PermissionMode } from "./core/types";
import {
  LEVELS,
  LEVEL_INFO,
  PERMISSION_MODES,
  PERMISSION_MODE_INFO,
} from "./core/types";
import {
  handleBashToolCall,
  handleMcpToolCall,
  handleWriteToolCall,
  isKnownReadTool,
} from "./handlers";
import { getStatusText, isQuietMode } from "./ui";

// Re-export types and constants needed by the hook
export {
  LEVELS,
  LEVEL_INFO,
  PERMISSION_MODES,
  PERMISSION_MODE_INFO,
  type PermissionLevel,
  type PermissionMode,
};

import {
  ExtensionContext,
  ToolCallEvent,
} from "@earendil-works/pi-coding-agent";
import { PermissionState } from "./core/types";

// ============================================================================
// SESSION START
// ============================================================================

export function handleSessionStart(
  state: PermissionState,
  ctx: ExtensionContext,
): void {
  const envLevel = process.env.PI_PERMISSION_LEVEL?.toLowerCase();
  if (envLevel && LEVELS.includes(envLevel as PermissionLevel)) {
    state.currentLevel = envLevel as PermissionLevel;
  } else {
    const globalLevel = loadGlobalPermission();
    if (globalLevel) {
      state.currentLevel = globalLevel;
    }
  }

  if (ctx.hasUI) {
    const globalMode = loadGlobalPermissionMode();
    if (globalMode) {
      state.permissionMode = globalMode;
    }
  }

  if (ctx.hasUI) {
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
  }
}

// ============================================================================
// TOOL CALL DISPATCHER
// ============================================================================

export async function handleToolCall(
  event: ToolCallEvent,
  ctx: ExtensionContext,
  state: PermissionState,
): Promise<any> {
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
}
