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

import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  type PermissionLevel,
  type PermissionMode,
  LEVELS,
  LEVEL_INDEX,
  LEVEL_INFO,
  LEVEL_ALLOWED_DESC,
  PERMISSION_MODES,
  PERMISSION_MODE_INFO,
  loadGlobalPermission,
  saveGlobalPermission,
  loadGlobalPermissionMode,
  saveGlobalPermissionMode,
  classifyCommand,
  loadPermissionConfig,
  savePermissionConfig,
  invalidateConfigCache,
  type PermissionConfig,
} from "./permission-core.js";

// Re-export types and constants needed by the hook
export {
  type PermissionLevel,
  type PermissionMode,
  LEVELS,
  LEVEL_INFO,
  PERMISSION_MODES,
  PERMISSION_MODE_INFO,
};

// ============================================================================
// STATUS TEXT
// ============================================================================

const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const GREEN = "\x1b[32m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";

const LEVEL_COLORS: Record<PermissionLevel, string> = {
  minimal: RED,
  low: YELLOW,
  medium: CYAN,
  high: GREEN,
  bypassed: DIM,
};

function getStatusText(level: PermissionLevel): string {
  const info = LEVEL_INFO[level];
  const color = LEVEL_COLORS[level];
  return `${BOLD}${color}${info.label}${RESET} ${DIM}- ${info.desc}${RESET}`;
}

// ============================================================================
// MODE DETECTION
// ============================================================================

function getPiModeFromArgv(argv: string[] = process.argv): string | undefined {
  // Support both: --mode rpc and --mode=rpc
  const eq = argv.find((a) => a.startsWith("--mode="));
  if (eq) return eq.slice("--mode=".length);

  const idx = argv.indexOf("--mode");
  if (idx !== -1 && idx + 1 < argv.length) return argv[idx + 1];

  return undefined;
}

function hasInteractiveUI(ctx: any): boolean {
  if (!ctx?.hasUI) return false;

  // In non-interactive modes (rpc/json/print), UI prompts are not desired.
  // We still allow notifications, but block instead of asking.
  const mode = getPiModeFromArgv()?.toLowerCase();
  if (mode && mode !== "interactive") return false;

  return true;
}

function isQuietMode(ctx: any): boolean {
  if (ctx?.quiet || ctx?.isQuiet) return true;
  if (ctx?.ui?.quiet || ctx?.ui?.isQuiet) return true;
  if (ctx?.settings?.quietStartup || ctx?.settings?.quiet) return true;

  const envQuiet = process.env.PI_QUIET?.toLowerCase();
  if (envQuiet && ["1", "true", "yes"].includes(envQuiet)) return true;

  if (process.argv.includes("--quiet") || process.argv.includes("-q")) return true;

  return isQuietStartupFromSettings();
}

function isQuietStartupFromSettings(): boolean {
  const settingsPath = path.join(os.homedir(), ".pi", "agent", "settings.json");
  try {
    const raw = fs.readFileSync(settingsPath, "utf-8");
    const settings = JSON.parse(raw) as { quietStartup?: boolean };
    return settings.quietStartup === true;
  } catch {
    return false;
  }
}

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

export interface PermissionState {
  currentLevel: PermissionLevel;
  isSessionOnly: boolean;
  permissionMode: PermissionMode;
  isModeSessionOnly: boolean;
}

export function createInitialState(): PermissionState {
  return {
    currentLevel: "minimal",
    isSessionOnly: false,
    permissionMode: "ask",
    isModeSessionOnly: false,
  };
}

function setLevel(
  state: PermissionState,
  level: PermissionLevel,
  saveGlobally: boolean,
  ctx: any
): void {
  state.currentLevel = level;
  state.isSessionOnly = !saveGlobally;
  if (saveGlobally) {
    saveGlobalPermission(level);
  }
  if (ctx.ui?.setStatus) {
    ctx.ui.setStatus("authority", getStatusText(level));
  }
}

function setMode(
  state: PermissionState,
  mode: PermissionMode,
  saveGlobally: boolean,
  ctx: any
): void {
  state.permissionMode = mode;
  state.isModeSessionOnly = !saveGlobally;
  if (saveGlobally) {
    saveGlobalPermissionMode(mode);
  }
}

// ============================================================================
// HANDLERS
// ============================================================================

/** Handle /permission config subcommand */
async function handleConfigSubcommand(
  state: PermissionState,
  args: string,
  ctx: any
): Promise<void> {
  const parts = args.trim().split(/\s+/);
  const action = parts[0];

  if (action === "show") {
    const config = loadPermissionConfig();
    const configStr = JSON.stringify(config, null, 2);
    ctx.ui.notify(`Permission Config:\n${configStr}`, "info");
    return;
  }

  if (action === "reset") {
    savePermissionConfig({});
    invalidateConfigCache();
    ctx.ui.notify("Permission config reset to defaults", "info");
    return;
  }

  // Show help
  const help = `Usage: /permission config <action>

Actions:
  show  - Display current configuration
  reset - Reset to default configuration

Edit ~/.pi/agent/settings.json directly for full control:

{
  "permissionConfig": {
    "overrides": {
      "minimal": ["tmux list-*", "tmux show-*"],
      "medium": ["tmux *", "screen *"],
      "high": ["rm -rf *"],
      "dangerous": ["dd if=* of=/dev/*"]
    },
    "prefixMappings": [
      { "from": "fvm flutter", "to": "flutter" },
      { "from": "nvm exec", "to": "" }
    ]
  }
}`;

  ctx.ui.notify(help, "info");
}

/** Handle /permission command */
export async function handlePermissionCommand(
  state: PermissionState,
  args: string,
  ctx: any
): Promise<void> {
  const arg = args.trim().toLowerCase();

  // Handle config subcommand
  if (arg === "config" || arg.startsWith("config ")) {
    const configArgs = arg.replace(/^config\s*/, '');
    await handleConfigSubcommand(state, configArgs, ctx);
    return;
  }

  // Direct level set: /permission medium
  if (arg && LEVELS.includes(arg as PermissionLevel)) {
    const newLevel = arg as PermissionLevel;

    if (hasInteractiveUI(ctx)) {
      const scope = await ctx.ui.select("Save permission level to:", [
        "Session only",
        "Global (persists)",
      ]);
      if (!scope) return;

      setLevel(state, newLevel, scope === "Global (persists)", ctx);
      const saveMsg = scope === "Global (persists)" ? " (saved globally)" : " (session only)";
      ctx.ui.notify(`Permission: ${LEVEL_INFO[newLevel].label}${saveMsg}`, "info");
    } else {
      setLevel(state, newLevel, false, ctx);
      ctx.ui.notify(`Permission: ${LEVEL_INFO[newLevel].label}`, "info");
    }
    return;
  }

  // Show current level (no UI)
  if (!hasInteractiveUI(ctx)) {
    ctx.ui.notify(
      `Current permission: ${LEVEL_INFO[state.currentLevel].label} (${LEVEL_INFO[state.currentLevel].desc})`,
      "info"
    );
    return;
  }

  // Show selector
  const options = LEVELS.map((level) => {
    const info = LEVEL_INFO[level];
    const marker = level === state.currentLevel ? " ← current" : "";
    return `${info.label}: ${info.desc}${marker}`;
  });

  const choice = await ctx.ui.select("Select permission level", options);
  if (!choice) return;

  const selectedLabel = choice.split(":")[0].trim();
  const newLevel = LEVELS.find((l) => LEVEL_INFO[l].label === selectedLabel);
  if (!newLevel || newLevel === state.currentLevel) return;

  const scope = await ctx.ui.select("Save to:", ["Session only", "Global (persists)"]);
  if (!scope) return;

  setLevel(state, newLevel, scope === "Global (persists)", ctx);
  const saveMsg = scope === "Global (persists)" ? " (saved globally)" : " (session only)";
  ctx.ui.notify(`Permission: ${LEVEL_INFO[newLevel].label}${saveMsg}`, "info");
}

/** Handle /permission-mode command */
export async function handlePermissionModeCommand(
  state: PermissionState,
  args: string,
  ctx: any
): Promise<void> {
  const arg = args.trim().toLowerCase();

  if (arg && PERMISSION_MODES.includes(arg as PermissionMode)) {
    const newMode = arg as PermissionMode;

    if (hasInteractiveUI(ctx)) {
      const scope = await ctx.ui.select("Save permission mode to:", [
        "Session only",
        "Global (persists)",
      ]);
      if (!scope) return;

      setMode(state, newMode, scope === "Global (persists)", ctx);
      const saveMsg = scope === "Global (persists)" ? " (saved globally)" : " (session only)";
      ctx.ui.notify(`Permission mode: ${PERMISSION_MODE_INFO[newMode].label}${saveMsg}`, "info");
    } else {
      setMode(state, newMode, false, ctx);
      ctx.ui.notify(`Permission mode: ${PERMISSION_MODE_INFO[newMode].label}`, "info");
    }
    return;
  }

  if (!hasInteractiveUI(ctx)) {
    ctx.ui.notify(
      `Current permission mode: ${PERMISSION_MODE_INFO[state.permissionMode].label} (${PERMISSION_MODE_INFO[state.permissionMode].desc})`,
      "info"
    );
    return;
  }

  const options = PERMISSION_MODES.map((mode) => {
    const info = PERMISSION_MODE_INFO[mode];
    const marker = mode === state.permissionMode ? " ← current" : "";
    return `${info.label}: ${info.desc}${marker}`;
  });

  const choice = await ctx.ui.select("Select permission mode", options);
  if (!choice) return;

  const selectedLabel = choice.split(":")[0].trim();
  const newMode = PERMISSION_MODES.find((m) => PERMISSION_MODE_INFO[m].label === selectedLabel);
  if (!newMode || newMode === state.permissionMode) return;

  const scope = await ctx.ui.select("Save to:", ["Session only", "Global (persists)"]);
  if (!scope) return;

  setMode(state, newMode, scope === "Global (persists)", ctx);
  const saveMsg = scope === "Global (persists)" ? " (saved globally)" : " (session only)";
  ctx.ui.notify(`Permission mode: ${PERMISSION_MODE_INFO[newMode].label}${saveMsg}`, "info");
}

/** Handle session_start - initialize level and show status */
export function handleSessionStart(state: PermissionState, ctx: any): void {
  // Check env var first (for print mode)
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
      ctx.ui.notify(`Permission: ${LEVEL_INFO[state.currentLevel].label} (use /permission to change)`, "info");
    }
    if (state.permissionMode === "block") {
      ctx.ui.notify("Permission mode: Block (use /permission-mode to change)", "info");
    }
  }
}

/** Detect the macOS bundle identifier of the terminal app running this process */
function detectTerminalBundleId(): string | null {
  // __CFBundleIdentifier works even through tmux/screen
  const bundleId = process.env.__CFBundleIdentifier;
  if (bundleId) return bundleId;

  if (process.env.GHOSTTY_RESOURCES_DIR) return "com.mitchellh.ghostty";
  if (process.env.ITERM_SESSION_ID) return "com.googlecode.iterm2";
  if (process.env.KITTY_PID) return "net.kovidgoyal.kitty";
  if (process.env.ALACRITTY_WINDOW_ID) return "org.alacritty";
  if (process.env.WARP_IS_LOCAL_SHELL_SESSION) return "dev.warp.Warp-Stable";
  if (process.env.TERM_PROGRAM === "Apple_Terminal") return "com.apple.Terminal";
  if (process.env.TERM_PROGRAM === "vscode") return "com.microsoft.VSCode";

  return null;
}

let _terminalBundleId: string | null | undefined;
function getTerminalBundleId(): string | null {
  if (_terminalBundleId === undefined) {
    _terminalBundleId = detectTerminalBundleId();
  }
  return _terminalBundleId;
}

/** Check if running inside tmux */
function isTmux(): boolean {
  return !!process.env.TMUX;
}

/** Check if terminal app is frontmost (macOS only) */
async function isAppFocused(): Promise<boolean> {
  if (process.platform !== "darwin") return true;

  const bundleId = getTerminalBundleId();
  if (!bundleId) return true;

  return new Promise((resolve) => {
    execFile('osascript', ['-e',
      'tell application "System Events" to return bundle identifier of first application process whose frontmost is true'
    ], { timeout: 500 }, (err, stdout) => {
      if (err) {
        resolve(true); // Assume focused on error
        return;
      }
      resolve(stdout.trim() === bundleId);
    });
  });
}

/** Check if terminal has focus (handles tmux panes + macOS app focus) */
async function isTerminalFocused(): Promise<boolean> {
  // Check tmux pane focus first
  if (isTmux()) {
    return new Promise((resolve) => {
      execFile('tmux', ['display-message', '-p', '#{pane_active}'], { timeout: 500 }, (err, stdout) => {
        if (err || stdout.trim() !== "1") {
          resolve(false); // Not in tmux client or pane not active
          return;
        }
        // Pane is active - also check if terminal app is focused
        resolve(isAppFocused());
      });
    });
  }

  return isAppFocused();
}

/** Send system notification only if terminal is not focused */
async function notifySystem(title: string, message: string): Promise<void> {
  const focused = await isTerminalFocused();
  if (focused) return;


  try {
    if (process.platform === "darwin") {
      const bundleId = getTerminalBundleId();
      const tnArgs = ['-title', title, '-message', message];
      if (bundleId) tnArgs.push('-activate', bundleId);

      execFile('terminal-notifier', tnArgs, () => {});
    } else if (process.platform === "linux") {
      execFile('notify-send', ['-u', 'critical', title, message], () => {});
    }
  } catch {
    // Silently fail if notifications unavailable
  }
}

/** Truncate a string for display, adding ellipsis if needed */
function truncate(s: string, maxLen = 80): string {
  const trimmed = s.trim();
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen - 1) + "…" : trimmed;
}

/** Handle dangerous commands - always prompt unless in block mode */
async function handleDangerousCommand(
  command: string,
  state: PermissionState,
  ctx: any
): Promise<{ block: true; reason: string } | undefined> {
  await notifySystem("⚠️ Permission Required", `Dangerous command: ${command}`);

  if (!hasInteractiveUI(ctx)) {
    return {
      block: true,
      reason: `Dangerous command requires confirmation: ${command}
User can re-run with: PI_PERMISSION_LEVEL=bypassed pi -p "..."`
    };
  }

  if (state.permissionMode === "block") {
    return {
      block: true,
      reason: `Blocked by permission mode (block). Dangerous command: ${command}
Use /permission-mode ask to enable confirmations.`
    };
  }

  const choice = await ctx.ui.select(`⚠️ Dangerous: $ ${truncate(command)}`, ["Allow once", "Cancel"]);

  if (choice !== "Allow once") {
    return { block: true, reason: "Cancelled by the user. Do not attempt to repeat or circumvent." };
  }
  return undefined;
}

/** Handle bash tool_call - check permission and prompt if needed */
export async function handleBashToolCall(
  state: PermissionState,
  command: string,
  ctx: any
): Promise<{ block: true; reason: string } | undefined> {
  if (state.currentLevel === "bypassed") return undefined;

  const classification = classifyCommand(command);

  // Dangerous commands - always prompt (special handling)
  if (classification.dangerous) {
    return handleDangerousCommand(command, state, ctx);
  }

  const displayCmd = truncate(command);

  // Use generic permission request for level-based checks
  return requestPermission({
    state,
    message: `$ ${displayCmd}`,
    requiredLevel: classification.level,
    details: `Command: ${displayCmd}`,
    notifyTitle: "Permission Required",
    envVarHint: `pi -p "..."`,
    ctx,
  });
}

// Tools handled by specific permission checks
// These must NOT be in KNOWN_READ_TOOLS since they need specific permission logic:
// - bash: classified by command content
// - write/edit: checked for Low level
//
// Read-only tools that can pass through without checks
const KNOWN_READ_TOOLS = new Set(["read", "ls", "grep", "find"]);

// MCP tool calls that are read-only - only require Low permission
const READONLY_MCP_TOOLS = new Set([
  // Serper (Google search)
  "serper_search",
  "serper_scrape",

  // GitHub - read operations
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

  // Atlassian - read operations
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

// MCP modes that are informational/read-only - only require Low permission
// These don't execute any tool, just query metadata
const MCP_READ_ONLY_MODES = new Set(["search", "describe", "list", "status", "connect"]);

/** Options for requestPermission helper */
interface PermissionRequestOptions {
  state: PermissionState;
  message: string;
  requiredLevel: PermissionLevel;
  details: string;
  notifyTitle: string;
  envVarHint: string;
  ctx: any;
}

/** Generic permission request handler - handles block mode, print mode, ask mode */
async function requestPermission(
  opts: PermissionRequestOptions
): Promise<{ block: true; reason: string } | undefined> {
  const { state, message, requiredLevel, details, notifyTitle, envVarHint, ctx } = opts;

  if (state.currentLevel === "bypassed") return undefined;

  const requiredIndex = LEVEL_INDEX[requiredLevel];
  const currentIndex = LEVEL_INDEX[state.currentLevel];

  // Already have sufficient permission
  if (currentIndex >= requiredIndex) return undefined;

  const requiredInfo = LEVEL_INFO[requiredLevel];

  // Notify if terminal not focused
  await notifySystem(
    notifyTitle,
    `${details} requires ${requiredInfo.label} level (current: ${LEVEL_INFO[state.currentLevel].label})`
  );

  // Print mode: block
  if (!hasInteractiveUI(ctx)) {
    return {
      block: true,
      reason: `${message}
Blocked by permission (${state.currentLevel}). Allowed at this level: ${LEVEL_ALLOWED_DESC[state.currentLevel]}
User can re-run with: PI_PERMISSION_LEVEL=${requiredLevel} ${envVarHint}`
    };
  }

  if (state.permissionMode === "block") {
    return {
      block: true,
      reason: `${message}
Blocked by permission (${state.currentLevel}, mode: block). Requires ${requiredInfo.label}.
Use /permission ${requiredLevel} or /permission-mode ask to enable prompts.`
    };
  }

  // Interactive mode: prompt
  const promptTitle = `${message}  [requires ${requiredInfo.label}]`;
  const allowAllLabel = `Allow all ${requiredInfo.label} (session)`;
  const choice = await ctx.ui.select(
    promptTitle,
    ["Allow once", allowAllLabel, "Cancel"]
  );

  if (choice === "Allow once") return undefined;

  if (choice === allowAllLabel) {
    setLevel(state, requiredLevel, false, ctx);
    ctx.ui.notify(`Permission → ${requiredInfo.label} (session only)`, "info");
    return undefined;
  }

  return { block: true, reason: "Cancelled by the user. Do not attempt to repeat or circumvent." };
}

/** Options for handleWriteToolCall */
export interface WriteToolCallOptions {
  state: PermissionState;
  toolName: string;
  filePath: string;
  ctx: any;
}

/** Handle mcp tool_call - show target tool and require MEDIUM permission */
export async function handleMcpToolCall(
  state: PermissionState,
  input: Record<string, any>,
  ctx: any
): Promise<{ block: true; reason: string } | undefined> {
  // Determine the mode and target from the input parameters
  // Mode priority: tool (call) > connect > describe > search > server (list) > action > status
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

  // Determine required permission level based on what's being called
  let requiredLevel: PermissionLevel;

  if (MCP_READ_ONLY_MODES.has(mode)) {
    // Informational MCP operations (search, describe, list, status, connect) are minimal
    // These only query pi's internal MCP gateway metadata, no external service calls
    requiredLevel = "minimal";
  } else if (mode === "call" && READONLY_MCP_TOOLS.has(targetTool)) {
    // Known read-only search tool calls are low - they query external APIs but are read-only
    requiredLevel = "low";
  } else {
    // All other MCP tool calls require medium
    requiredLevel = "medium";
  }

  // Show notification even if we have permission
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
}

/** Handle unknown tool_call - require HIGH permission */
async function handleUnknownToolCall(
  state: PermissionState,
  toolName: string,
  ctx: any
): Promise<{ block: true; reason: string } | undefined> {
  return requestPermission({
    state,
    message: `⚠️ Unknown tool "${toolName}" requires High permission`,
    requiredLevel: "high",
    details: `Unknown tool "${toolName}"`,
    notifyTitle: "Permission Required",
    envVarHint: 'pi -p "..."',
    ctx,
  });
}

/** Handle write/edit tool_call - check permission and prompt if needed */
export async function handleWriteToolCall(
  opts: WriteToolCallOptions
): Promise<{ block: true; reason: string } | undefined> {
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
}

// ============================================================================
// Extension entry point
// ============================================================================

export default function (pi: ExtensionAPI) {
  const state = createInitialState();

  pi.registerCommand("permission", {
    description: "View or change permission level",
    handler: (args, ctx) => handlePermissionCommand(state, args, ctx),
  });

  pi.registerCommand("permission-mode", {
    description: "Set permission prompt mode (ask or block)",
    handler: (args, ctx) => handlePermissionModeCommand(state, args, ctx),
  });

  pi.on("session_start", async (_event, ctx) => {
    handleSessionStart(state, ctx);
  });

  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName === "bash") {
      return handleBashToolCall(state, event.input.command as string, ctx);
    }

    // MCP tool - show which tool it wants to call
    if (event.toolName === "mcp") {
      return handleMcpToolCall(state, event.input, ctx);
    }

    // File write/edit operations (write, edit)
    if (["write", "edit"].includes(event.toolName)) {
      const input = event.input as { path: string };
      return handleWriteToolCall({
        state,
        toolName: event.toolName,
        filePath: input.path,
        ctx,
      });
    }

    // Unknown tools trigger HIGH permission mode
    if (!KNOWN_READ_TOOLS.has(event.toolName)) {
      return handleUnknownToolCall(state, event.toolName, ctx);
    }

    return undefined;
  });
}
