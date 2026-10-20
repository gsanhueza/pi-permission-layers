/**
 * Settings persistence - load/save global permission level, mode, and config
 */

import * as path from "node:path";
import type { PermissionConfig } from "./interfaces";
import { SettingsManager } from "./manager";
import type { PermissionLevel, PermissionMode } from "./types";
import { LEVELS, PERMISSION_MODES } from "./types";

export class SettingsService {
  private manager: SettingsManager;

  constructor(agentDir: string) {
    this.manager = new SettingsManager(path.join(agentDir, "settings.json"));
  }

  loadGlobalPermissionLevel(): PermissionLevel | null {
    const settings = this.manager.load();
    const level = (settings.permissionLevel as string)?.toLowerCase();
    if (level && LEVELS.includes(level as PermissionLevel)) {
      return level as PermissionLevel;
    }
    return null;
  }

  saveGlobalPermissionLevel(level: PermissionLevel): void {
    const settings = this.manager.load();
    settings.permissionLevel = level;
    this.manager.save(settings);
  }

  loadGlobalPermissionMode(): PermissionMode | null {
    const settings = this.manager.load();
    const mode = (settings.permissionMode as string)?.toLowerCase();
    if (mode && PERMISSION_MODES.includes(mode as PermissionMode)) {
      return mode as PermissionMode;
    }
    return null;
  }

  saveGlobalPermissionMode(mode: PermissionMode): void {
    const settings = this.manager.load();
    settings.permissionMode = mode;
    this.manager.save(settings);
  }

  loadPermissionConfig(): PermissionConfig {
    const settings = this.manager.load();
    return this.manager.validate(settings.permissionConfig as PermissionConfig);
  }

  savePermissionConfig(config: PermissionConfig): void {
    const settings = this.manager.load();
    settings.permissionConfig = config;
    this.manager.save(settings);
  }
}
