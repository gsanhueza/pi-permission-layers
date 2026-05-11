/**
 * Types and constants for permission system
 */

// ============================================================================
// CORE TYPES
// ============================================================================

export type PermissionLevel =
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "bypassed";

export type PermissionMode = "ask" | "block";

export const LEVELS: PermissionLevel[] = [
  "minimal",
  "low",
  "medium",
  "high",
  "bypassed",
];
export const PERMISSION_MODES: PermissionMode[] = ["ask", "block"];

export const LEVEL_INDEX: Record<PermissionLevel, number> = {
  minimal: 0,
  low: 1,
  medium: 2,
  high: 3,
  bypassed: 4,
};

export const LEVEL_INFO: Record<
  PermissionLevel,
  { label: string; desc: string }
> = {
  minimal: { label: "Minimal", desc: "Read-only" },
  low: { label: "Low", desc: "File ops only" },
  medium: { label: "Medium", desc: "Dev operations" },
  high: { label: "High", desc: "Full operations" },
  bypassed: { label: "Bypassed", desc: "All checks disabled" },
};

export const PERMISSION_MODE_INFO: Record<
  PermissionMode,
  { label: string; desc: string }
> = {
  ask: { label: "Ask", desc: "Prompt when permission is required" },
  block: { label: "Block", desc: "Block instead of prompting" },
};

export const LEVEL_ALLOWED_DESC: Record<PermissionLevel, string> = {
  minimal:
    "read-only (cat, ls, grep, git status/diff/log, npm list, version checks)",
  low: "read-only + file write/edit",
  medium:
    "dev ops (install packages, build, test, git commit/pull, file operations)",
  high: "full operations except dangerous commands",
  bypassed: "all operations",
};

// ============================================================================
// CONFIGURATION TYPES
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
  ctx: any;
}

export interface PermissionRequestOptions {
  state: PermissionState;
  message: string;
  requiredLevel: PermissionLevel;
  details: string;
  notifyTitle: string;
  envVarHint: string;
  ctx: any;
}

// ============================================================================
// VALIDATION
// ============================================================================

export function validateConfig(config: unknown): PermissionConfig {
  if (!config || typeof config !== "object") {
    return {};
  }

  const result: PermissionConfig = {};
  const raw = config as Record<string, unknown>;

  if (raw.overrides && typeof raw.overrides === "object") {
    const overrides = raw.overrides as Record<string, unknown>;
    result.overrides = {};

    const levels = ["minimal", "low", "medium", "high", "dangerous"] as const;
    for (const level of levels) {
      const patterns = overrides[level];
      if (Array.isArray(patterns)) {
        const validPatterns = patterns
          .filter((p): p is string => typeof p === "string" && p.length > 0)
          .slice(0, 100);
        if (validPatterns.length > 0) {
          result.overrides[level] = validPatterns;
        }
      }
    }
  }

  if (Array.isArray(raw.prefixMappings)) {
    const validMappings = raw.prefixMappings
      .filter(
        (m): m is { from: string; to: string } =>
          m &&
          typeof m === "object" &&
          typeof (m as any).from === "string" &&
          (m as any).from.length > 0 &&
          typeof (m as any).to === "string",
      )
      .slice(0, 50);
    if (validMappings.length > 0) {
      result.prefixMappings = validMappings;
    }
  }

  return result;
}
