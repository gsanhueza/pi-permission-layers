import { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Notification, PermissionLevel, PermissionMode } from "./types";

// ============================================================================
// PERMISSION CONFIGURATION
// ============================================================================

export interface PermissionConfig {
  /** Override patterns to force specific permission levels */
  overrides?: PermissionOverrides;
  /** Prefix mappings to normalize commands before classification */
  prefixMappings?: PermissionPrefixMapping[];
  /** Per-tool permission level assignments */
  tools?: ToolPermissionConfig;
  /** Per-MCP-tool permission level assignments */
  mcp?: McpPermissionConfig;
  /** Hide startup usage help */
  quietStartup?: boolean;
  /** Force interactive UI mode regardless of context */
  forceUI?: boolean;
  /** System notifications */
  systemNotifications?: Notification;
}

export interface ToolPermissionConfig {
  minimal?: string[];
  low?: string[];
  medium?: string[];
  high?: string[];
  dangerous?: string[];
}

export interface McpPermissionConfig {
  minimal?: string[];
  low?: string[];
  medium?: string[];
  high?: string[];
  dangerous?: string[];
}

export interface PermissionOverrides {
  minimal?: string[];
  low?: string[];
  medium?: string[];
  high?: string[];
  dangerous?: string[];
}

export interface PermissionPrefixMapping {
  from: string;
  to: string;
}

// ============================================================================
// CLASSIFICATION TYPES
// ============================================================================

export interface Classification {
  level: PermissionLevel;
  dangerous: boolean;
}

// ============================================================================
// STATE TYPES
// ============================================================================

export interface PermissionState {
  currentLevel: PermissionLevel;
  isSessionOnly: boolean;
  permissionMode: PermissionMode;
  isModeSessionOnly: boolean;
}

// ============================================================================
// TOOL CALL OPTIONS TYPES
// ============================================================================

export interface WriteToolCallOptions {
  state: PermissionState;
  toolName: string;
  filePath: string;
  ctx: ExtensionContext;
}

export interface PermissionRequestOptions {
  state: PermissionState;
  message: string;
  requiredLevel: PermissionLevel;
  details: string;
  notifyTitle: string;
  envVarHint: string;
  ctx: ExtensionContext;
}
