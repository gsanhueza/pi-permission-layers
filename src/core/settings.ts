/**
 * Settings persistence - load/save global permission level, mode, and config
 */

import { getAgentDir } from "@earendil-works/pi-coding-agent";
import * as path from "node:path";
import type { PermissionConfig } from "./interfaces";
import { SettingsManager } from "./manager";
import type { PermissionLevel, PermissionMode } from "./types";
import { LEVELS, PERMISSION_MODES } from "./types";

const getSettingsPath = () => path.join(getAgentDir(), "settings.json");
const settingsManager = new SettingsManager(getSettingsPath());

// ============================================================================
// GLOBAL PERMISSION LEVEL
// ============================================================================

export const loadGlobalPermissionLevel = (): PermissionLevel | null => {
  const settings = settingsManager.load();
  const level = (settings.permissionLevel as string)?.toLowerCase();
  if (level && LEVELS.includes(level as PermissionLevel)) {
    return level as PermissionLevel;
  }
  return null;
};

export const saveGlobalPermissionLevel = (level: PermissionLevel): void => {
  const settings = settingsManager.load();
  settings.permissionLevel = level;
  settingsManager.save(settings);
};

// ============================================================================
// GLOBAL PERMISSION MODE
// ============================================================================

export const loadGlobalPermissionMode = (): PermissionMode | null => {
  const settings = settingsManager.load();
  const mode = (settings.permissionMode as string)?.toLowerCase();
  if (mode && PERMISSION_MODES.includes(mode as PermissionMode)) {
    return mode as PermissionMode;
  }
  return null;
};

export const saveGlobalPermissionMode = (mode: PermissionMode): void => {
  const settings = settingsManager.load();
  settings.permissionMode = mode;
  settingsManager.save(settings);
};

// ============================================================================
// PERMISSION CONFIG
// ============================================================================

export const loadPermissionConfig = (): PermissionConfig => {
  const settings = settingsManager.load();
  return settingsManager.validate(
    settings.permissionConfig as PermissionConfig,
  );
};

export const savePermissionConfig = (config: PermissionConfig): void => {
  const settings = settingsManager.load();
  settings.permissionConfig = config;
  settingsManager.save(settings);
};
