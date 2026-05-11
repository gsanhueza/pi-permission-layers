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
import { LEVELS, PERMISSION_MODES, validateConfig } from "./types";

// ============================================================================
// SETTINGS FILE I/O
// ============================================================================

function getSettingsPath(): string {
  return path.join(process.env.HOME || "", ".pi", "agent", "settings.json");
}

function loadSettings(): Record<string, unknown> {
  try {
    return JSON.parse(fs.readFileSync(getSettingsPath(), "utf-8"));
  } catch {
    return {};
  }
}

function saveSettings(settings: Record<string, unknown>): void {
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
}

// ============================================================================
// GLOBAL PERMISSION LEVEL
// ============================================================================

export function loadGlobalPermission(): PermissionLevel | null {
  const settings = loadSettings();
  const level = (settings.permissionLevel as string)?.toLowerCase();
  if (level && LEVELS.includes(level as PermissionLevel)) {
    return level as PermissionLevel;
  }
  return null;
}

export function saveGlobalPermission(level: PermissionLevel): void {
  const settings = loadSettings();
  settings.permissionLevel = level;
  saveSettings(settings);
}

// ============================================================================
// GLOBAL PERMISSION MODE
// ============================================================================

export function loadGlobalPermissionMode(): PermissionMode | null {
  const settings = loadSettings();
  const mode = (settings.permissionMode as string)?.toLowerCase();
  if (mode && PERMISSION_MODES.includes(mode as PermissionMode)) {
    return mode as PermissionMode;
  }
  return null;
}

export function saveGlobalPermissionMode(mode: PermissionMode): void {
  const settings = loadSettings();
  settings.permissionMode = mode;
  saveSettings(settings);
}

// ============================================================================
// PERMISSION CONFIG
// ============================================================================

export function loadPermissionConfig(): PermissionConfig {
  const settings = loadSettings();
  return validateConfig(settings.permissionConfig);
}

export function savePermissionConfig(config: PermissionConfig): void {
  const settings = loadSettings();
  settings.permissionConfig = config;
  saveSettings(settings);
}
