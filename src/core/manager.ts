import * as fs from "node:fs";
import * as path from "node:path";
import {
  McpPermissionConfig,
  PermissionConfig,
  PermissionOverrides,
  PermissionPrefixMapping,
  ToolPermissionConfig,
} from "./interfaces";
import { Notification } from "./types";

export class SettingsManager {
  constructor(private readonly settingsPath: string) {}

  load(): Record<string, unknown> {
    try {
      return JSON.parse(fs.readFileSync(this.settingsPath, "utf-8"));
    } catch {
      return {};
    }
  }

  save(settings: Record<string, unknown>): void {
    const settingsPath = this.settingsPath;
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

  validate(raw: PermissionConfig): PermissionConfig {
    if (!raw || typeof raw !== "object") return {};

    const overrides = this.validateOverrides(raw);
    const prefixMappings = this.validatePrefixMappings(raw);
    const tools = this.validateToolConfig(raw.tools);
    const mcp = this.validateMcpConfig(raw.mcp);
    const quietStartup = this.validateQuietStartup(raw);
    const forceUI = this.validateForceUI(raw);
    const systemNotifications = this.validateSystemNotifications(raw);

    // Only return what we know is not default
    const response: PermissionConfig = {};

    if (overrides) response.overrides = overrides;
    if (prefixMappings.length > 0) response.prefixMappings = prefixMappings;
    if (tools) response.tools = tools;
    if (mcp) response.mcp = mcp;
    if (quietStartup !== undefined) response.quietStartup = quietStartup;
    if (forceUI !== undefined) response.forceUI = forceUI;
    if (systemNotifications !== undefined)
      response.systemNotifications = systemNotifications;

    return response;
  }

  private validateOverrides(
    raw: PermissionConfig,
  ): PermissionOverrides | undefined {
    const overrides = raw.overrides;

    if (!(overrides && typeof overrides === "object")) {
      return undefined;
    }

    const response: PermissionOverrides = {};
    const levels = ["minimal", "low", "medium", "high", "dangerous"] as const;

    for (const level of levels) {
      const patterns = overrides[level];
      if (Array.isArray(patterns)) {
        const valid = patterns
          .filter((p): p is string => typeof p === "string" && p.length > 0)
          .slice(0, 100);

        if (valid.length > 0) {
          response[level] = valid;
        }
      }
    }

    const hasEntries = Object.keys(response).length > 0;
    return hasEntries ? response : undefined;
  }

  private validateToolConfig(
    config: ToolPermissionConfig | undefined,
  ): ToolPermissionConfig | undefined {
    if (!config || typeof config !== "object") return undefined;

    const response: ToolPermissionConfig = {};
    const levels = ["minimal", "low", "medium", "high", "dangerous"] as const;

    for (const level of levels) {
      const items = config[level];
      if (Array.isArray(items)) {
        const valid = items
          .filter((p): p is string => typeof p === "string" && p.length > 0)
          .slice(0, 100);

        if (valid.length > 0) {
          response[level] = valid;
        }
      }
    }

    const hasEntries = Object.keys(response).length > 0;
    return hasEntries ? response : undefined;
  }

  private validateMcpConfig(
    config: McpPermissionConfig | undefined,
  ): McpPermissionConfig | undefined {
    if (!config || typeof config !== "object") return undefined;

    const response: McpPermissionConfig = {};
    const levels = ["minimal", "low", "medium", "high", "dangerous"] as const;

    for (const level of levels) {
      const items = config[level];
      if (Array.isArray(items)) {
        const valid = items
          .filter((p): p is string => typeof p === "string" && p.length > 0)
          .slice(0, 100);

        if (valid.length > 0) {
          response[level] = valid;
        }
      }
    }

    const hasEntries = Object.keys(response).length > 0;
    return hasEntries ? response : undefined;
  }

  private validatePrefixMappings(
    result: PermissionConfig,
  ): PermissionPrefixMapping[] {
    const prefixMappings = result.prefixMappings;

    if (!Array.isArray(prefixMappings)) {
      return [];
    }

    const response = prefixMappings
      .filter(
        (m): m is { from: string; to: string } =>
          typeof m === "object" &&
          m !== null &&
          "from" in m &&
          typeof m.from === "string" &&
          m.from.length > 0 &&
          "to" in m &&
          typeof m.to === "string",
      )
      .slice(0, 50);

    return response;
  }

  private validateQuietStartup(raw: PermissionConfig): boolean | undefined {
    return raw.quietStartup;
  }

  private validateForceUI(raw: PermissionConfig): boolean | undefined {
    return raw.forceUI;
  }

  private validateSystemNotifications(
    raw: PermissionConfig,
  ): Notification | undefined {
    return raw.systemNotifications;
  }
}
