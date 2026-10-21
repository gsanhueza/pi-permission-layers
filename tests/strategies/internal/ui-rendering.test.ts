/**
 * Tests for getStatusText and isQuietMode — simple UI rendering functions.
 *
 * Run with: npm test
 */

import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  getStatusText,
  isQuietMode,
  notifySystem,
} from "../../../src/strategies/internal/ui-rendering";
import type { SettingsService } from "../../../src/core/settings";

// ============================================================================
// getStatusText
// ============================================================================

describe("getStatusText", () => {
  test("minimal label", () => {
    const result = getStatusText("minimal");
    expect(result).toContain("Minimal");
    expect(result).toContain("Read-only");
  });

  test("low label", () => {
    const result = getStatusText("low");
    expect(result).toContain("Low");
    expect(result).toContain("File ops only");
  });

  test("medium label", () => {
    const result = getStatusText("medium");
    expect(result).toContain("Medium");
    expect(result).toContain("Dev operations");
  });

  test("high label", () => {
    const result = getStatusText("high");
    expect(result).toContain("High");
    expect(result).toContain("Full operations");
  });

  test("bypassed label", () => {
    const result = getStatusText("bypassed");
    expect(result).toContain("Bypassed");
    expect(result).toContain("All checks disabled");
  });

  test("includes ANSI escape codes", () => {
    const result = getStatusText("high");
    expect(result).toContain("\x1b[1m"); // BOLD
    expect(result).toContain("\x1b[0m"); // RESET
  });
});

// ============================================================================
// isQuietMode
// ============================================================================

describe("isQuietMode", () => {
  const mockSettingsService: SettingsService = {
    getPermissionConfig: () => ({}),
    savePermissionConfig: () => {},
    clearCache: () => {},
    loadGlobalPermissionLevel: () => null,
    loadGlobalPermissionMode: () => null,
    saveGlobalPermissionLevel: () => {},
    saveGlobalPermissionMode: () => {},
  } as unknown as SettingsService;

  beforeEach(() => {
    delete process.env.PI_QUIET;
    process.argv = ["node", "pi"];
  });

  test("returns true when PI_QUIET=1", () => {
    process.env.PI_QUIET = "1";
    expect(isQuietMode({} as never, mockSettingsService)).toBe(true);
  });

  test("returns true when PI_QUIET=true", () => {
    process.env.PI_QUIET = "true";
    expect(isQuietMode({} as never, mockSettingsService)).toBe(true);
  });

  test("returns true when PI_QUIET=yes", () => {
    process.env.PI_QUIET = "yes";
    expect(isQuietMode({} as never, mockSettingsService)).toBe(true);
  });

  test("returns true with --quiet flag", () => {
    process.argv = ["node", "pi", "--quiet"];
    expect(isQuietMode({} as never, mockSettingsService)).toBe(true);
  });

  test("returns true with -q flag", () => {
    process.argv = ["node", "pi", "-q"];
    expect(isQuietMode({} as never, mockSettingsService)).toBe(true);
  });

  test("returns true when config has quietStartup", () => {
    const service: SettingsService = {
      getPermissionConfig: () => ({ quietStartup: true }),
      savePermissionConfig: () => {},
      clearCache: () => {},
      loadGlobalPermissionLevel: () => null,
      loadGlobalPermissionMode: () => null,
      saveGlobalPermissionLevel: () => {},
      saveGlobalPermissionMode: () => {},
    } as unknown as SettingsService;

    expect(isQuietMode({} as never, service)).toBe(true);
  });

  test("returns false when none of the quiet signals are set", () => {
    expect(isQuietMode({} as never, mockSettingsService)).toBe(false);
  });
});

// ============================================================================
// notifySystem
// ============================================================================

describe("notifySystem", () => {
  test("does nothing when systemNotifications is off", async () => {
    const execFile = vi.fn() as any;
    const service: SettingsService = {
      getPermissionConfig: () => ({ systemNotifications: "off" }),
      savePermissionConfig: () => {},
      clearCache: () => {},
      loadGlobalPermissionLevel: () => null,
      loadGlobalPermissionMode: () => null,
      saveGlobalPermissionLevel: () => {},
      saveGlobalPermissionMode: () => {},
    } as unknown as SettingsService;

    await notifySystem("Title", "Body", service, execFile);
    expect(execFile).not.toHaveBeenCalled();
  });

  test("calls terminal-notifier on darwin", async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", {
      value: "darwin",
      configurable: true,
    });

    const execFile = vi.fn() as any;
    const service: SettingsService = {
      getPermissionConfig: () => ({ systemNotifications: "on" }),
      savePermissionConfig: () => {},
      clearCache: () => {},
      loadGlobalPermissionLevel: () => null,
      loadGlobalPermissionMode: () => null,
      saveGlobalPermissionLevel: () => {},
      saveGlobalPermissionMode: () => {},
    } as unknown as SettingsService;

    await notifySystem("Title", "Body", service, execFile);
    expect(execFile).toHaveBeenCalledWith(
      "terminal-notifier",
      expect.arrayContaining(["-title", "Title", "-message", "Body"]),
      expect.any(Function),
    );

    Object.defineProperty(process, "platform", {
      value: originalPlatform,
      configurable: true,
    });
  });

  test("calls notify-send on linux", async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", {
      value: "linux",
      configurable: true,
    });

    const execFile = vi.fn() as any;
    const service: SettingsService = {
      getPermissionConfig: () => ({ systemNotifications: "on" }),
      savePermissionConfig: () => {},
      clearCache: () => {},
      loadGlobalPermissionLevel: () => null,
      loadGlobalPermissionMode: () => null,
      saveGlobalPermissionLevel: () => {},
      saveGlobalPermissionMode: () => {},
    } as unknown as SettingsService;

    await notifySystem("Title", "Body", service, execFile);
    expect(execFile).toHaveBeenCalledWith(
      "notify-send",
      expect.arrayContaining(["-a", "pi-permission-layers", "Title", "Body"]),
      expect.any(Function),
    );

    Object.defineProperty(process, "platform", {
      value: originalPlatform,
      configurable: true,
    });
  });

  test("adds -u critical for persistent mode on linux", async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", {
      value: "linux",
      configurable: true,
    });

    const execFile = vi.fn() as any;
    const service: SettingsService = {
      getPermissionConfig: () => ({ systemNotifications: "persistent" }),
      savePermissionConfig: () => {},
      clearCache: () => {},
      loadGlobalPermissionLevel: () => null,
      loadGlobalPermissionMode: () => null,
      saveGlobalPermissionLevel: () => {},
      saveGlobalPermissionMode: () => {},
    } as unknown as SettingsService;

    await notifySystem("Title", "Body", service, execFile);
    expect(execFile).toHaveBeenCalledWith(
      "notify-send",
      expect.arrayContaining(["-u", "critical"]),
      expect.any(Function),
    );

    Object.defineProperty(process, "platform", {
      value: originalPlatform,
      configurable: true,
    });
  });
});
