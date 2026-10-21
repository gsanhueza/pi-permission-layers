/**
 * Tests for SettingsService — load/save global level/mode, config caching.
 *
 * Run with: npm test
 */

import { describe, expect, test } from "vitest";
import { SettingsService } from "../../src/core/settings";
import type { SettingsManager } from "../../src/core/manager";

// ============================================================================
// MOCKS
// ============================================================================

function createManagerMock(initialData: Record<string, unknown> = {}): {
  manager: Partial<SettingsManager>;
  loadCalls: Record<string, unknown>[];
  saveCalls: Record<string, unknown>[];
} {
  const loadCalls: Record<string, unknown>[] = [];
  const saveCalls: Record<string, unknown>[] = [];
  let data = { ...initialData };

  return {
    manager: {
      load: () => {
        loadCalls.push(data);
        return data;
      },
      save: (s: Record<string, unknown>) => {
        saveCalls.push(s);
        data = { ...s };
      },
      validate: (config: Record<string, unknown>) => config ?? {},
    },
    loadCalls,
    saveCalls,
  };
}

// ============================================================================
// loadGlobalPermissionLevel
// ============================================================================

describe("SettingsService: loadGlobalPermissionLevel", () => {
  test("returns the saved level", () => {
    const { manager } = createManagerMock({ permissionLevel: "low" });
    const service = new SettingsService("/nonexistent");
    // Replace the internal manager with our mock
    (service as any).manager = manager as any;

    expect(service.loadGlobalPermissionLevel()).toBe("low");
  });

  test("returns null for invalid level", () => {
    const { manager } = createManagerMock({ permissionLevel: "banana" });
    const service = new SettingsService("/nonexistent");
    (service as any).manager = manager as any;

    expect(service.loadGlobalPermissionLevel()).toBeNull();
  });

  test("returns null when not set", () => {
    const { manager } = createManagerMock({});
    const service = new SettingsService("/nonexistent");
    (service as any).manager = manager as any;

    expect(service.loadGlobalPermissionLevel()).toBeNull();
  });

  test("is case-insensitive", () => {
    const { manager } = createManagerMock({ permissionLevel: "MEDIUM" });
    const service = new SettingsService("/nonexistent");
    (service as any).manager = manager as any;

    expect(service.loadGlobalPermissionLevel()).toBe("medium");
  });
});

// ============================================================================
// saveGlobalPermissionLevel
// ============================================================================

describe("SettingsService: saveGlobalPermissionLevel", () => {
  test("persists the level to disk", () => {
    const { manager, saveCalls } = createManagerMock({});
    const service = new SettingsService("/nonexistent");
    (service as any).manager = manager as any;

    service.saveGlobalPermissionLevel("high");

    expect(saveCalls.length).toBe(1);
    expect(saveCalls[0].permissionLevel).toBe("high");
  });
});

// ============================================================================
// loadGlobalPermissionMode
// ============================================================================

describe("SettingsService: loadGlobalPermissionMode", () => {
  test("returns the saved mode", () => {
    const { manager } = createManagerMock({ permissionMode: "block" });
    const service = new SettingsService("/nonexistent");
    (service as any).manager = manager as any;

    expect(service.loadGlobalPermissionMode()).toBe("block");
  });

  test("returns null when not set", () => {
    const { manager } = createManagerMock({});
    const service = new SettingsService("/nonexistent");
    (service as any).manager = manager as any;

    expect(service.loadGlobalPermissionMode()).toBeNull();
  });

  test("is case-insensitive", () => {
    const { manager } = createManagerMock({ permissionMode: "ASK" });
    const service = new SettingsService("/nonexistent");
    (service as any).manager = manager as any;

    expect(service.loadGlobalPermissionMode()).toBe("ask");
  });
});

// ============================================================================
// saveGlobalPermissionMode
// ============================================================================

describe("SettingsService: saveGlobalPermissionMode", () => {
  test("persists the mode to disk", () => {
    const { manager, saveCalls } = createManagerMock({});
    const service = new SettingsService("/nonexistent");
    (service as any).manager = manager as any;

    service.saveGlobalPermissionMode("block");

    expect(saveCalls.length).toBe(1);
    expect(saveCalls[0].permissionMode).toBe("block");
  });
});

// ============================================================================
// getPermissionConfig (caching)
// ============================================================================

describe("SettingsService: getPermissionConfig", () => {
  test("returns cached config within TTL", () => {
    const { manager } = createManagerMock({
      permissionConfig: { quietStartup: true },
    });
    const service = new SettingsService("/nonexistent");
    (service as any).manager = manager as any;

    const config1 = service.getPermissionConfig();
    const config2 = service.getPermissionConfig();

    expect(config1).toEqual(config2);
  });

  test("returns empty config when none set", () => {
    const { manager } = createManagerMock({});
    const service = new SettingsService("/nonexistent");
    (service as any).manager = manager as any;

    expect(service.getPermissionConfig()).toEqual({});
  });
});

// ============================================================================
// savePermissionConfig
// ============================================================================

describe("SettingsService: savePermissionConfig", () => {
  test("persists config and updates cache", () => {
    const { manager, saveCalls } = createManagerMock({
      permissionConfig: {},
    });
    const service = new SettingsService("/nonexistent");
    (service as any).manager = manager as any;

    service.savePermissionConfig({ quietStartup: true });

    expect(saveCalls.length).toBe(1);
    expect(saveCalls[0].permissionConfig).toEqual({ quietStartup: true });
    expect(service.getPermissionConfig()).toEqual({ quietStartup: true });
  });
});

// ============================================================================
// clearCache
// ============================================================================

describe("SettingsService: clearCache", () => {
  test("resets cache so next read reloads", () => {
    const { manager } = createManagerMock({
      permissionConfig: { quietStartup: true },
    });
    const service = new SettingsService("/nonexistent");
    (service as any).manager = manager as any;

    service.getPermissionConfig(); // warm cache
    service.clearCache();

    // After clear, the next read should trigger a reload from manager
    const config = service.getPermissionConfig();
    expect(config).toEqual({ quietStartup: true });
  });
});
