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
  private cachedConfig: PermissionConfig = {};
  private cachedAt: number = 0;
  private readonly ttlMs: number = 5000;

  /**
   * Create a SettingsService backed by the agent's settings file.
   *
   * @param agentDir - The agent directory path.
   */
  constructor(agentDir: string) {
    this.manager = new SettingsManager(path.join(agentDir, "settings.json"));
    this.loadConfig();
  }

  /** Check whether the in-memory config cache has exceeded its TTL. */
  private isCacheStale(): boolean {
    return Date.now() - this.cachedAt > this.ttlMs;
  }

  /** Load and validate the permission config from disk into the in-memory cache. */
  private loadConfig(): void {
    const settings = this.manager.load();
    this.cachedConfig = this.manager.validate(
      settings.permissionConfig as PermissionConfig,
    );
    this.cachedAt = Date.now();
  }

  /**
   * Load the globally saved permission level from disk.
   *
   * @returns The saved level, or null if not set.
   */
  loadGlobalPermissionLevel(): PermissionLevel | null {
    const settings = this.manager.load();
    const level = (settings.permissionLevel as string)?.toLowerCase();
    if (level && LEVELS.includes(level as PermissionLevel)) {
      return level as PermissionLevel;
    }
    return null;
  }

  /**
   * Save a permission level globally to disk.
   *
   * @param level - The permission level to persist.
   */
  saveGlobalPermissionLevel(level: PermissionLevel): void {
    const settings = this.manager.load();
    settings.permissionLevel = level;
    this.manager.save(settings);
  }

  /**
   * Load the globally saved permission mode from disk.
   *
   * @returns The saved mode, or null if not set.
   */
  loadGlobalPermissionMode(): PermissionMode | null {
    const settings = this.manager.load();
    const mode = (settings.permissionMode as string)?.toLowerCase();
    if (mode && PERMISSION_MODES.includes(mode as PermissionMode)) {
      return mode as PermissionMode;
    }
    return null;
  }

  /**
   * Save a permission mode globally to disk.
   *
   * @param mode - The permission mode to persist.
   */
  saveGlobalPermissionMode(mode: PermissionMode): void {
    const settings = this.manager.load();
    settings.permissionMode = mode;
    this.manager.save(settings);
  }

  /** Load permission config — serves from in-memory cache (5s TTL). */
  getPermissionConfig(): PermissionConfig {
    if (this.isCacheStale()) {
      this.loadConfig();
    }
    return this.cachedConfig;
  }

  /**
   * Save a permission config to disk and update the in-memory cache.
   *
   * @param config - The config to persist.
   */
  savePermissionConfig(config: PermissionConfig): void {
    const settings = this.manager.load();
    settings.permissionConfig = config;
    this.manager.save(settings);
    // Update in-memory cache so subsequent reads see the new config
    this.cachedConfig = config;
  }

  /** Clear in-memory cache so next read reloads from disk. */
  clearCache(): void {
    this.cachedConfig = {};
    this.cachedAt = 0;
  }
}
