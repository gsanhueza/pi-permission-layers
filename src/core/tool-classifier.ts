/**
 * Tool and MCP permission classification.
 *
 * Implements the delta/override model: user config is a layer on top of
 * built-in defaults. Tools/MCPs explicitly listed in config use that level;
 * everything else falls through to the default classification.
 *
 * Most restrictive wins: if a tool/MCP appears in multiple config levels,
 * the most restrictive level applies.
 */

import type {
  Classification,
  McpPermissionConfig,
  ToolPermissionConfig,
} from "./interfaces";

// ============================================================================
// DEFAULT PERMISSIONS
// ============================================================================

/** Default tool permissions — used when no user config exists or is incomplete. */
export const DEFAULT_TOOL_PERMISSIONS: ToolPermissionConfig = {
  minimal: ["read", "ls", "grep", "find"],
  low: ["write", "edit"],
};

/** Default MCP permissions.
 *
 * "minimal" contains MODE names (search, describe, list, status, connect).
 * "low" contains specific MCP TOOL names (45 known read-only tools).
 * "medium" is implicit: all other MCP tools fall through to medium.
 */
export const DEFAULT_MCP_PERMISSIONS: McpPermissionConfig = {
  minimal: ["search", "describe", "list", "status", "connect"],
  low: [
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
  ],
};

// Known MCP modes for matching
const KNOWN_MCP_MODES = new Set([
  "search",
  "describe",
  "list",
  "status",
  "connect",
  "call",
  "action",
]);

// Ordered from most restrictive to least restrictive (dangerous is handled separately)
const CONFIG_LEVELS: ("high" | "medium" | "low" | "minimal")[] = [
  "high",
  "medium",
  "low",
  "minimal",
];

// ============================================================================
// SHARED RESOLVER
// ============================================================================

/**
 * Resolve the effective permission level for a tool or MCP entry.
 *
 * Checks levels from most restrictive to least (dangerous → high → medium → low → minimal).
 * Returns the first match — ensuring most restrictive wins.
 *
 * @param name - The tool name or MCP tool/mode name to look up.
 * @param config - User-provided config (may be undefined).
 * @param defaults - Default config to fall back to.
 * @returns Classification if found, null if nothing matches.
 */
function resolveLevel(
  name: string,
  config: ToolPermissionConfig | McpPermissionConfig | undefined,
  defaults: ToolPermissionConfig | McpPermissionConfig,
): Classification | null {
  // 1. Check user config (most restrictive level wins)
  if (config) {
    // Check dangerous first (highest priority)
    if (config.dangerous && config.dangerous.includes(name)) {
      return { level: "high", dangerous: true };
    }
    for (const level of CONFIG_LEVELS) {
      const entries = config[level];
      if (entries && entries.includes(name)) {
        return { level, dangerous: false };
      }
    }
  }

  // 2. Fall back to defaults
  // Check dangerous first
  if (defaults.dangerous && defaults.dangerous.includes(name)) {
    return { level: "high", dangerous: true };
  }
  for (const level of CONFIG_LEVELS) {
    const entries = defaults[level];
    if (entries && entries.includes(name)) {
      return { level, dangerous: false };
    }
  }

  // 3. Not found in either — caller handles "unknown"
  return null;
}

// ============================================================================
// TOOL RESOLVER
// ============================================================================

/**
 * Resolve the effective permission for a tool.
 *
 * 1. Check user config first (most restrictive level wins)
 * 2. Fall back to DEFAULT_TOOL_PERMISSIONS
 * 3. Return null if not found (caller handles "unknown tool" block)
 *
 * @param toolName - The tool name to resolve.
 * @param userConfig - User-provided tool config (may be undefined).
 * @returns Classification if found, null if not found in either config or defaults.
 */
export const resolveToolLevel = (
  toolName: string,
  userConfig: ToolPermissionConfig | undefined,
): Classification | null => {
  return resolveLevel(toolName, userConfig, DEFAULT_TOOL_PERMISSIONS);
};

// ============================================================================
// MCP RESOLVER
// ============================================================================

/**
 * Resolve the effective permission for an MCP tool call.
 *
 * Checks two types of entries:
 * - Known modes (search, describe, list, status, connect, call, action) → match against the call's mode
 * - Tool names (everything else) → match against the call's targetTool
 *
 * Tool name match takes precedence over mode match (more specific → more general).
 *
 * Resolution order:
 * 1. Check user config for the specific tool name (most restrictive level wins)
 * 2. If user config has mode-level entries, check those
 * 3. Fall back to DEFAULT_MCP_PERMISSIONS (modes → minimal, known tools → low, rest → medium)
 * 4. Return null if not found anywhere (caller treats as medium — current default)
 *
 * @param targetTool - The MCP tool name (e.g., "github_list_commits").
 * @param mode - The MCP mode (e.g., "call", "search", "describe").
 * @param userConfig - User-provided MCP config (may be undefined).
 * @returns Classification if found, null if not found in either config or defaults.
 */
export const resolveMcpLevel = (
  targetTool: string,
  mode: string,
  userConfig: McpPermissionConfig | undefined,
): Classification | null => {
  // 1. Check user config for the specific tool name first (most specific match)
  const toolNameResult = resolveLevel(
    targetTool,
    userConfig,
    DEFAULT_MCP_PERMISSIONS,
  );
  if (toolNameResult) {
    return toolNameResult;
  }

  // 2. If the mode is a known mode, check mode-level entries in user config
  //    (also falls back to defaults if not found in user config)
  if (KNOWN_MCP_MODES.has(mode)) {
    const modeResult = resolveLevel(mode, userConfig, DEFAULT_MCP_PERMISSIONS);
    if (modeResult) {
      return modeResult;
    }
  }

  // 3. Not found — caller treats as medium (current default)
  return null;
};
