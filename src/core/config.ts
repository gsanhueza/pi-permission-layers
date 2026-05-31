import { Classification, PermissionConfig } from "./interfaces";
import { loadPermissionConfig } from "./settings";

// ============================================================================
// CONFIGURATION CACHING
// ============================================================================

let configCache: PermissionConfig | null = null;
let configCacheTime = 0;
const CONFIG_CACHE_TTL = 5000; // 5 seconds

let regexCache: Map<string, RegExp> = new Map();
const MAX_REGEX_CACHE_SIZE = 500;

export const invalidateConfigCache = (): void => {
  configCache = null;
  regexCache.clear();
};

export const getCachedConfig = (): PermissionConfig => {
  const now = Date.now();
  if (!configCache || now - configCacheTime > CONFIG_CACHE_TTL) {
    configCache = loadPermissionConfig();
    configCacheTime = now;
  }
  return configCache;
};

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

export const globToRegex = (pattern: string): RegExp => {
  try {
    if (/\*{5,}/.test(pattern)) {
      return /(?!)/;
    }

    let regex = pattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*")
      .replace(/\?/g, ".");

    return new RegExp(`^${regex}$`, "i");
  } catch {
    return /(?!)/;
  }
};

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
