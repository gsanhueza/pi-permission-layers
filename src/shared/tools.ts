/**
 * Shared tool detection logic used by both UI and no-UI handlers.
 */

import type { PermissionConfig } from "../core/interfaces";
import type { PermissionLevel } from "../core/types";

// ============================================================================
// KNOWN READ-ONLY TOOLS
// ============================================================================

export const KNOWN_READ_TOOLS = new Set(["read", "ls", "grep", "find"]);

const getKnownReadTools = (config?: PermissionConfig): Set<string> => {
  const tools = config?.knownReadTools ?? Array.from(KNOWN_READ_TOOLS);
  return new Set(tools);
};

export const isKnownReadTool = (toolName: string, config?: PermissionConfig): boolean => {
  return getKnownReadTools(config).has(toolName);
};

// ============================================================================
// MCP TOOL DETECTION
// ============================================================================

export const READONLY_MCP_TOOLS = new Set([
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

const getReadonlyMcpTools = (config?: PermissionConfig): Set<string> => {
  const tools = config?.readonlyMcpTools ?? Array.from(READONLY_MCP_TOOLS);
  return new Set(tools);
};

export const MCP_READ_ONLY_MODES = new Set([
  "search",
  "describe",
  "list",
  "status",
  "connect",
]);

export interface McpToolInfo {
  targetTool: string;
  mode: string;
  requiredLevel: PermissionLevel;
}

export interface McpToolInput {
  tool?: string;
  connect?: string;
  describe?: string;
  search?: string;
  server?: string;
  action?: string;
  [key: string]: unknown;
}

export const parseMcpInput = (input: McpToolInput, config?: PermissionConfig): McpToolInfo => {
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
  } else if (mode === "call" && getReadonlyMcpTools(config).has(targetTool)) {
    requiredLevel = "low";
  } else {
    requiredLevel = "medium";
  }

  return { targetTool, mode, requiredLevel };
};
