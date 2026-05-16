/**
 * Permission Extension for pi-coding-agent
 *
 * Implements layered permission control.
 *
 * Interactive mode:
 *   Use `/permission` command to view or change the level.
 *   Use `/permission-mode` to switch between ask vs block.
 *   When changing via command, you'll be asked: session-only or global?
 *
 * Print mode (pi -p):
 *   Set PI_PERMISSION_LEVEL env var: PI_PERMISSION_LEVEL=medium pi -p "task"
 *   Operations beyond level will exit with helpful error message.
 *   Use PI_PERMISSION_LEVEL=bypassed for CI/containers (dangerous!)
 *
 * Levels:
 *   minimal - Read-only mode (default)
 *             ✅ Read files, ls, grep, git status/log/diff
 *             ❌ No file modifications, no commands with side effects
 *
 *   low    - File operations only
 *            ✅ Create/edit files in project directory
 *            ❌ No package installs, no git commits, no builds
 *
 *   medium - Development operations
 *            ✅ npm/pip install, git commit/pull, make/build
 *            ❌ No git push, no sudo, no production changes
 *
 *   high   - Full operations
 *            ✅ git push, deployments, scripts
 *            ⚠️ Still prompts for destructive commands (rm -rf, etc.)
 *
 */

import {
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
  SessionStartEvent,
  ToolCallEvent,
} from "@earendil-works/pi-coding-agent";
import {
  handlePermissionCommand as handlePermissionCommand_noUI,
  handlePermissionModeCommand as handlePermissionModeCommand_noUI,
} from "./no-ui/commands";
import { handleSessionStart as handleSessionStart_noUI } from "./no-ui/events";
import {
  handlePermissionCommand as handlePermissionCommand_UI,
  handlePermissionModeCommand as handlePermissionModeCommand_UI,
} from "./ui/commands";
import { handleSessionStart, handleToolCall } from "./ui/events";
import { createInitialState } from "./ui/state";
import { hasInteractiveUI } from "./ui/ui";

export default (pi: ExtensionAPI) => {
  const state = createInitialState();

  pi.registerCommand("permission", {
    description: "View or change permission level",
    handler: (args: string, ctx: ExtensionCommandContext) => {
      if (hasInteractiveUI(ctx)) {
        return handlePermissionCommand_UI(state, args, ctx);
      }
      return handlePermissionCommand_noUI(state, args, ctx);
    },
  });

  pi.registerCommand("permission-mode", {
    description: "Set permission prompt mode (ask or block)",
    handler: (args: string, ctx: ExtensionCommandContext) => {
      if (hasInteractiveUI(ctx)) {
        return handlePermissionModeCommand_UI(state, args, ctx);
      }
      return handlePermissionModeCommand_noUI(state, args, ctx);
    },
  });

  pi.on(
    "session_start",
    async (_event: SessionStartEvent, ctx: ExtensionContext) => {
      if (hasInteractiveUI(ctx)) {
        handleSessionStart(state, ctx);
      } else {
        handleSessionStart_noUI(state);
      }
    },
  );

  pi.on("tool_call", async (event: ToolCallEvent, ctx: ExtensionContext) => {
    return handleToolCall(event, ctx, state);
  });
};
