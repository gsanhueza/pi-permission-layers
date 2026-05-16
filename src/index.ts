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
import {
  handleSessionStart as handleSessionStart_noUI,
  handleToolCall as handleToolCall_noUI,
} from "./no-ui/events";
import {
  handlePermissionCommand,
  handlePermissionModeCommand,
} from "./ui/commands";
import { handleSessionStart, handleToolCall } from "./ui/events";
import { createInitialState } from "./ui/state";
import { hasInteractiveUI } from "./ui/ui";

export default (pi: ExtensionAPI) => {
  const state = createInitialState();

  // Route UI vs no-UI handlers based on interactive context
  const dispatch = <T>(ctx: ExtensionContext, ui: () => T, noUi: () => T): T =>
    hasInteractiveUI(ctx) ? ui() : noUi();

  pi.registerCommand("permission", {
    description: "View or change permission level",
    handler: (args: string, ctx: ExtensionCommandContext) =>
      dispatch(
        ctx,
        () => handlePermissionCommand(state, args, ctx),
        () => handlePermissionCommand_noUI(state, args, ctx),
      ),
  });

  pi.registerCommand("permission-mode", {
    description: "Set permission prompt mode (ask or block)",
    handler: (args: string, ctx: ExtensionCommandContext) =>
      dispatch(
        ctx,
        () => handlePermissionModeCommand(state, args, ctx),
        () => handlePermissionModeCommand_noUI(state, args, ctx),
      ),
  });

  pi.on(
    "session_start",
    async (_event: SessionStartEvent, ctx: ExtensionContext) =>
      dispatch(
        ctx,
        () => handleSessionStart(state, ctx),
        () => handleSessionStart_noUI(state),
      ),
  );

  pi.on("tool_call", async (event: ToolCallEvent, ctx: ExtensionContext) =>
    dispatch(
      ctx,
      () => handleToolCall(event, ctx, state),
      () => handleToolCall_noUI(event, state),
    ),
  );
};
