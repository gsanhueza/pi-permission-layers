import { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { PermissionLevel, PermissionMode } from "./types";

// ============================================================================
// PERMISSION CONFIGURATION
// ============================================================================

export interface PermissionConfig {
  /** Override patterns to force specific permission levels */
  overrides?: {
    minimal?: string[];
    low?: string[];
    medium?: string[];
    high?: string[];
    dangerous?: string[];
  };
  /** Prefix mappings to normalize commands before classification */
  prefixMappings?: Array<{
    from: string;
    to: string;
  }>;
  /** Hide startup usage help */
  quietStartup?: boolean;
  /** Force interactive UI mode regardless of context */
  forceUI?: boolean;
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
