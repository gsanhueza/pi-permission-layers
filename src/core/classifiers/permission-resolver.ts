/**
 * Shared permission resolution algorithm.
 *
 * Implements the delta/override model: user config is a layer on top of
 * built-in defaults. Entries explicitly listed in config use that level;
 * everything else falls through to the default classification.
 *
 * Most restrictive wins: if a tool/MCP appears in multiple config levels,
 * the most restrictive level applies.
 */

import type {
  Classification,
  McpPermissionConfig,
  ToolPermissionConfig,
} from "../interfaces";

// Ordered from most restrictive to least restrictive (dangerous is handled separately)
const CONFIG_LEVELS: ("high" | "medium" | "low" | "minimal")[] = [
  "high",
  "medium",
  "low",
  "minimal",
];

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
export const resolveLevel = (
  name: string,
  config: ToolPermissionConfig | McpPermissionConfig | undefined,
  defaults: ToolPermissionConfig | McpPermissionConfig,
): Classification | null => {
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
};
