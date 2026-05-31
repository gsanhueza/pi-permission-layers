/**
 * Tool permission classification.
 *
 * Uses the shared delta/override resolver from `permission-resolver.ts`.
 */

import type { Classification, ToolPermissionConfig } from "../interfaces";
import { resolveLevel } from "./permission-resolver";

// ============================================================================
// DEFAULT PERMISSIONS
// ============================================================================

/** Default tool permissions — used when no user config exists or is incomplete. */
export const DEFAULT_TOOL_PERMISSIONS: ToolPermissionConfig = {
  minimal: ["read", "ls", "grep", "find"],
  low: ["write", "edit"],
};

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
