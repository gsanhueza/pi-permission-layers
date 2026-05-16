/**
 * Settings persistence - load/save global permission level, mode, and config
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type {
  PermissionConfig,
  PermissionLevel,
  PermissionMode,
} from "./types";
import { LEVELS, PERMISSION_MODES } from "./types";

// ============================================================================
// CONFIG VALIDATION
// ============================================================================

const validateConfig = (raw: PermissionConfig): PermissionConfig => {
  if (!raw || typeof raw !== "object") return {};

  const result: PermissionConfig = {};
  const overrides = raw.overrides as Record<string, unknown> | undefined;

  if (overrides && typeof overrides === "object") {
    result.overrides = {};
    const levels = ["minimal", "low", "medium", "high", "dangerous"] as const;
    for (const level of levels) {
      const patterns = overrides[level];
      if (Array.isArray(patterns)) {
        const valid = patterns
          .filter((p): p is string => typeof p === "string" && p.length > 0)
          .slice(0, 100);
        if (valid.length > 0) result.overrides[level] = valid;
      }
    }
  }

  if (Array.isArray(raw.prefixMappings)) {
    const valid = raw.prefixMappings
      .filter(
        (m): m is { from: string; to: string } =>
          m &&
          typeof m === "object" &&
          typeof (m as any).from === "string" &&
          (m as any).from.length > 0 &&
          typeof (m as any).to === "string",
      )
      .slice(0, 50);
    if (valid.length > 0) result.prefixMappings = valid;
  }

  result.quietStartup = raw.quietStartup ?? false;

  return result;
};

// ============================================================================
// SETTINGS FILE I/O
// ============================================================================

const getSettingsPath = (): string => {
  return path.join(process.env.HOME || "", ".pi", "agent", "settings.json");
};

const loadSettings = (): Record<string, unknown> => {
  try {
    return JSON.parse(fs.readFileSync(getSettingsPath(), "utf-8"));
  } catch {
    return {};
  }
};

const saveSettings = (settings: Record<string, unknown>): void => {
  const settingsPath = getSettingsPath();
  const dir = path.dirname(settingsPath);
  const tempPath = `${settingsPath}.tmp`;

  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    // Atomic write: write to temp file first, then rename
    fs.writeFileSync(tempPath, JSON.stringify(settings, null, 2) + "\n");
    fs.renameSync(tempPath, settingsPath); // Atomic on POSIX systems
  } catch (e) {
    // Clean up temp file on error
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    } catch {}
    throw e;
  }
};

// ============================================================================
// GLOBAL PERMISSION LEVEL
// ============================================================================

export const loadGlobalPermission = (): PermissionLevel | null => {
  const settings = loadSettings();
  const level = (settings.permissionLevel as string)?.toLowerCase();
  if (level && LEVELS.includes(level as PermissionLevel)) {
    return level as PermissionLevel;
  }
  return null;
};

export const saveGlobalPermission = (level: PermissionLevel): void => {
  const settings = loadSettings();
  settings.permissionLevel = level;
  saveSettings(settings);
};

// ============================================================================
// GLOBAL PERMISSION MODE
// ============================================================================

export const loadGlobalPermissionMode = (): PermissionMode | null => {
  const settings = loadSettings();
  const mode = (settings.permissionMode as string)?.toLowerCase();
  if (mode && PERMISSION_MODES.includes(mode as PermissionMode)) {
    return mode as PermissionMode;
  }
  return null;
};

export const saveGlobalPermissionMode = (mode: PermissionMode): void => {
  const settings = loadSettings();
  settings.permissionMode = mode;
  saveSettings(settings);
};

// ============================================================================
// PERMISSION CONFIG
// ============================================================================

export const loadPermissionConfig = (): PermissionConfig => {
  const settings = loadSettings();
  return validateConfig(settings.permissionConfig as PermissionConfig);
};

export const savePermissionConfig = (config: PermissionConfig): void => {
  const settings = loadSettings();
  settings.permissionConfig = config;
  saveSettings(settings);
};
