/**
 * Tool call handlers - bash, mcp, write/edit, unknown tools
 */

import { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { classifyCommand } from "./core/classifier";
import type {
  PermissionLevel,
  PermissionRequestOptions,
  PermissionState,
  WriteToolCallOptions,
} from "./core/types";
import { LEVEL_INDEX, LEVEL_INFO } from "./core/types";
import { setLevel } from "./state";
import { hasInteractiveUI, notifySystem, truncate } from "./ui";

// ============================================================================
// DANGEROUS COMMAND HANDLER
// ============================================================================

const handleDangerousCommand = async (
  command: string,
  state: PermissionState,
  ctx: ExtensionContext,
): Promise<{ block: true; reason: string } | undefined> => {
  await notifySystem("⚠️ Permission Required", `Dangerous command: ${command}`);

  if (!hasInteractiveUI(ctx)) {
    return {
      block: true,
      reason: `Dangerous command requires confirmation: ${command}
User can re-run with: PI_PERMISSION_LEVEL=bypassed pi -p "..."`,
    };
  }

  if (state.permissionMode === "block") {
    return {
      block: true,
      reason: `Blocked by permission mode (block). Dangerous command: ${command}
Use /permission-mode ask to enable confirmations.`,
    };
  }

  const choice = await ctx.ui.select(`⚠️ Dangerous: $ ${truncate(command)}`, [
    "Allow once",
    "Cancel",
  ]);

  if (choice !== "Allow once") {
    return {
      block: true,
      reason: "Cancelled by the user. Do not attempt to repeat or circumvent.",
    };
  }
  return undefined;
};

// ============================================================================
// PERMISSION REQUEST HELPER
// ============================================================================

const requestPermission = async (
  opts: PermissionRequestOptions,
): Promise<
  | {
      block: true;
      reason: string;
    }
  | undefined
> => {
  const {
    state,
    message,
    requiredLevel,
    details,
    notifyTitle,
    envVarHint,
    ctx,
  } = opts;

  if (state.currentLevel === "bypassed") return undefined;

  const requiredIndex = LEVEL_INDEX[requiredLevel];
  const currentIndex = LEVEL_INDEX[state.currentLevel];

  if (currentIndex >= requiredIndex) return undefined;

  const requiredInfo = LEVEL_INFO[requiredLevel];

  await notifySystem(
    notifyTitle,
    `${details} requires ${requiredInfo.label} level (current: ${LEVEL_INFO[state.currentLevel].label})`,
  );

  if (!hasInteractiveUI(ctx)) {
    return {
      block: true,
      reason: `${message}
Blocked by permission (${state.currentLevel}). Allowed at this level: ${LEVEL_INFO[state.currentLevel].desc}
User can re-run with: PI_PERMISSION_LEVEL=${requiredLevel} ${envVarHint}`,
    };
  }

  if (state.permissionMode === "block") {
    return {
      block: true,
      reason: `${message}
Blocked by permission (${state.currentLevel}, mode: block). Requires ${requiredInfo.label}.
Use /permission ${requiredLevel} or /permission-mode ask to enable prompts.`,
    };
  }

  const promptTitle = `${message}  [requires ${requiredInfo.label}]`;
  const allowAllLabel = `Allow all ${requiredInfo.label} (session)`;
  const choice = await ctx.ui.select(promptTitle, [
    "Allow once",
    allowAllLabel,
    "Cancel",
  ]);

  if (choice === "Allow once") return undefined;

  if (choice === allowAllLabel) {
    setLevel(state, requiredLevel, false, ctx);
    ctx.ui.notify(`Permission → ${requiredInfo.label} (session only)`, "info");
    return undefined;
  }

  return {
    block: true,
    reason: "Cancelled by the user. Do not attempt to repeat or circumvent.",
  };
};

// ============================================================================
// BASH TOOL HANDLER
// ============================================================================

export const handleBashToolCall = async (
  state: PermissionState,
  command: string,
  ctx: ExtensionContext,
): Promise<{ block: true; reason: string } | undefined> => {
  if (state.currentLevel === "bypassed") return undefined;

  const classification = classifyCommand(command);

  if (classification.dangerous) {
    return handleDangerousCommand(command, state, ctx);
  }

  const displayCmd = truncate(command);

  return requestPermission({
    state,
    message: `$ ${displayCmd}`,
    requiredLevel: classification.level,
    details: `Command: ${displayCmd}`,
    notifyTitle: "Permission Required",
    envVarHint: `pi -p "..."`,
    ctx,
  });
};

// ============================================================================
// MCP TOOL HANDLER
// ============================================================================

const KNOWN_READ_TOOLS = new Set(["read", "ls", "grep", "find"]);

const READONLY_MCP_TOOLS = new Set([
  "serper_search",
  "serper_scrape",
  "github_get_commit",
  "github_get_file_contents",
  "github_get_label",
  "github_get_latest_release",
  "github_get_me",
  "github_get_release_by_tag",
  "github_get_tag",
  "github_get_team_members",
  "github_get_teams",
  "github_issue_read",
  "github_pull_request_read",
  "github_list_branches",
  "github_list_commits",
  "github_list_issue_types",
  "github_list_issues",
  "github_list_pull_requests",
  "github_list_releases",
  "github_list_tags",
  "github_search_code",
  "github_search_issues",
  "github_search_pull_requests",
  "github_search_repositories",
  "github_search_users",
  "atlassian_atlassianUserInfo",
  "atlassian_getAccessibleAtlassianResources",
  "atlassian_getConfluencePage",
  "atlassian_searchConfluenceUsingCql",
  "atlassian_getConfluenceSpaces",
  "atlassian_getPagesInConfluenceSpace",
  "atlassian_getConfluencePageFooterComments",
  "atlassian_getConfluencePageInlineComments",
  "atlassian_getConfluenceCommentChildren",
  "atlassian_getConfluencePageDescendants",
  "atlassian_getJiraIssue",
  "atlassian_getTransitionsForJiraIssue",
  "atlassian_getJiraIssueRemoteIssueLinks",
  "atlassian_getVisibleJiraProjects",
  "atlassian_getJiraProjectIssueTypesMetadata",
  "atlassian_getJiraIssueTypeMetaWithFields",
  "atlassian_searchJiraIssuesUsingJql",
  "atlassian_searchAtlassian",
  "atlassian_fetchAtlassian",
  "atlassian_lookupJiraAccountId",
  "atlassian_getIssueLinkTypes",
]);

const MCP_READ_ONLY_MODES = new Set([
  "search",
  "describe",
  "list",
  "status",
  "connect",
]);

export const handleMcpToolCall = async (
  state: PermissionState,
  input: Record<string, any>,
  ctx: ExtensionContext,
): Promise<{ block: true; reason: string } | undefined> => {
  let targetTool: string;
  let mode: string;

  if (input.tool) {
    targetTool = input.tool;
    mode = "call";
  } else if (input.connect) {
    targetTool = `connect(${input.connect})`;
    mode = "connect";
  } else if (input.describe) {
    targetTool = `describe(${input.describe})`;
    mode = "describe";
  } else if (input.search) {
    targetTool = `search(${input.search})`;
    mode = "search";
  } else if (input.server) {
    targetTool = `list(${input.server})`;
    mode = "list";
  } else if (input.action) {
    targetTool = `action(${input.action})`;
    mode = "action";
  } else {
    targetTool = "status";
    mode = "status";
  }

  let requiredLevel: PermissionLevel;

  if (MCP_READ_ONLY_MODES.has(mode)) {
    requiredLevel = "minimal";
  } else if (mode === "call" && READONLY_MCP_TOOLS.has(targetTool)) {
    requiredLevel = "low";
  } else {
    requiredLevel = "medium";
  }

  if (LEVEL_INDEX[state.currentLevel] >= LEVEL_INDEX[requiredLevel]) {
    ctx.ui.notify(`MCP tool: ${targetTool}`, "info");
    return undefined;
  }

  return requestPermission({
    state,
    message: `MCP tool wants to call: ${targetTool}`,
    requiredLevel,
    details: `MCP tool "${targetTool}"`,
    notifyTitle: "MCP Tool Call",
    envVarHint: 'pi -p "..."',
    ctx,
  });
};

// ============================================================================
// WRITE/EDIT TOOL HANDLER
// ============================================================================

export const handleWriteToolCall = async (
  opts: WriteToolCallOptions,
): Promise<{ block: true; reason: string } | undefined> => {
  const { state, toolName, filePath, ctx } = opts;

  if (state.currentLevel === "bypassed") return undefined;
  if (LEVEL_INDEX[state.currentLevel] >= LEVEL_INDEX["low"]) return undefined;

  const action = toolName === "write" ? "Write" : "Edit";

  return requestPermission({
    state,
    message: `Requires Low: ${action} ${filePath}`,
    requiredLevel: "low",
    details: `${action}`,
    notifyTitle: "Permission Required",
    envVarHint: 'pi -p "..."',
    ctx,
  });
};

// ============================================================================
// READ-ONLY TOOL CHECK
// ============================================================================

export const isKnownReadTool = (toolName: string): boolean => {
  return KNOWN_READ_TOOLS.has(toolName);
};
