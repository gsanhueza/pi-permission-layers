import { Classification, PermissionConfig } from "./interfaces";

// ============================================================================
// REGEX CACHING
// ============================================================================

let regexCache: Map<string, RegExp> = new Map();
const MAX_REGEX_CACHE_SIZE = 500;

/**
 * Get a compiled RegExp from cache, building and caching if missing.
 *
 * @param pattern - The glob pattern to compile.
 * @returns A compiled RegExp instance.
 */
const getCachedRegex = (pattern: string): RegExp => {
  let regex = regexCache.get(pattern);
  if (!regex) {
    if (regexCache.size >= MAX_REGEX_CACHE_SIZE) {
      const firstKey = regexCache.keys().next().value;
      if (firstKey) regexCache.delete(firstKey);
    }
    regex = globToRegex(pattern);
    regexCache.set(pattern, regex);
  }
  return regex;
};

// ============================================================================
// PATTERN MATCHING
// ============================================================================

/**
 * Convert a glob pattern string to a RegExp.
 *
 * @param pattern - The glob pattern (supports `*` and `?`).
 * @returns A compiled RegExp, or a never-match regex on failure.
 */
export const globToRegex = (pattern: string): RegExp => {
  if (/\*{5,}/.test(pattern)) {
    return /(?!)/;
  }

  let regex = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");

  return new RegExp(`^${regex}$`, "i");
};

/**
 * Test whether a command matches any of the given glob patterns.
 *
 * @param command - The command string to test.
 * @param patterns - Array of glob patterns, or null/undefined.
 * @returns True if any pattern matches.
 */
export const matchesAnyPattern = (
  command: string,
  patterns: string[] | undefined | null,
): boolean => {
  if (!patterns || !Array.isArray(patterns) || patterns.length === 0) {
    return false;
  }
  return patterns.some(
    (pattern) =>
      typeof pattern === "string" && getCachedRegex(pattern).test(command),
  );
};

// ============================================================================
// PREFIX MAPPINGS
// ============================================================================

/**
 * Apply configured prefix mappings to normalize a command before classification.
 *
 * @param command - The raw command string.
 * @param mappings - Prefix mappings to apply.
 * @returns The normalized command.
 */
export const applyPrefixMappings = (
  command: string,
  mappings: PermissionConfig["prefixMappings"],
): string => {
  if (!mappings || !Array.isArray(mappings) || mappings.length === 0)
    return command;

  const trimmed = command.trim();
  const trimmedLower = trimmed.toLowerCase();

  for (const mapping of mappings) {
    if (
      !mapping ||
      typeof mapping.from !== "string" ||
      typeof mapping.to !== "string"
    ) {
      continue;
    }

    const { from, to } = mapping;
    const fromLower = from.toLowerCase();

    if (trimmedLower.startsWith(fromLower)) {
      const afterPrefix = trimmed.substring(fromLower.length);
      if (afterPrefix === "" || /^\s/.test(afterPrefix)) {
        const remainder = afterPrefix.replace(/^\s+/, "");
        if (to === "") {
          return remainder;
        }
        return remainder ? `${to} ${remainder}` : to;
      }
    }
  }

  return command;
};

// ============================================================================
// OVERRIDE CHECKING
// ============================================================================

/**
 * Check whether the command matches any override patterns.
 *
 * @param command - The command to check.
 * @param overrides - Override patterns by permission level.
 * @returns Classification if an override matches, null otherwise.
 */
export const checkOverrides = (
  command: string,
  overrides: PermissionConfig["overrides"],
): Classification | null => {
  if (!overrides) return null;

  const trimmed = command.trim();

  if (overrides.dangerous && matchesAnyPattern(trimmed, overrides.dangerous)) {
    return { level: "high", dangerous: true };
  }

  if (overrides.high && matchesAnyPattern(trimmed, overrides.high)) {
    return { level: "high", dangerous: false };
  }

  if (overrides.medium && matchesAnyPattern(trimmed, overrides.medium)) {
    return { level: "medium", dangerous: false };
  }

  if (overrides.low && matchesAnyPattern(trimmed, overrides.low)) {
    return { level: "low", dangerous: false };
  }

  if (overrides.minimal && matchesAnyPattern(trimmed, overrides.minimal)) {
    return { level: "minimal", dangerous: false };
  }

  return null;
};
