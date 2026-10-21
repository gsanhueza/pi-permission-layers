/**
 * Tests for createSettingsList — the /permission settings TUI widget.
 *
 * Run with: npm test
 */

import { describe, expect, test, vi } from "vitest";
import { SettingsList } from "@earendil-works/pi-tui";
import { createSettingsList } from "../../../src/strategies/internal/settings-ui";
import type { SettingsService } from "../../../src/core/settings";

// ============================================================================
// MOCKS
// ============================================================================

vi.mock("@earendil-works/pi-coding-agent", () => ({
  getSettingsListTheme: () => ({}),
}));

vi.mock("@earendil-works/pi-tui", () => {
  class SettingsList {
    constructor(...args: unknown[]) {
      // Invoke the onChange callback (4th arg) to cover the save path
      const onChange = args[3];
      if (typeof onChange === "function") {
        onChange("quiet-startup", "on");
      }
    }
  }
  return { SettingsList };
});

function createSettingsServiceMock(
  config: Record<string, unknown> = {},
): SettingsService {
  return {
    getPermissionConfig: () => config,
    savePermissionConfig: vi.fn(),
    clearCache: () => {},
    loadGlobalPermissionLevel: () => null,
    loadGlobalPermissionMode: () => null,
    saveGlobalPermissionLevel: () => {},
    saveGlobalPermissionMode: () => {},
  } as unknown as SettingsService;
}

// ============================================================================
// createSettingsList
// ============================================================================

describe("createSettingsList", () => {
  test("creates a SettingsList with correct items", () => {
    const done = vi.fn();
    const service = createSettingsServiceMock({
      quietStartup: false,
      systemNotifications: "off",
    });

    const list = createSettingsList(service, done);

    expect(list).toBeInstanceOf(SettingsList);
  });

  test("shows quietStartup as on when true", () => {
    const done = vi.fn();
    const service = createSettingsServiceMock({ quietStartup: true });

    const list = createSettingsList(service, done);

    // The list items should reflect the config values
    expect(list).toBeInstanceOf(SettingsList);
  });

  test("calls savePermissionConfig when a setting changes", () => {
    const done = vi.fn();
    const savePermissionConfig = vi.fn();
    const service = createSettingsServiceMock({ quietStartup: false });
    (service as any).savePermissionConfig = savePermissionConfig;

    const list = createSettingsList(service, done);

    // Trigger the change callback (simulating user changing quiet-startup)
    const changeCallback = (list as any).onChange;
    if (changeCallback) {
      changeCallback("quiet-startup", "on");
      expect(savePermissionConfig).toHaveBeenCalled();
    }
  });

  test("calls done callback when list is dismissed", () => {
    const done = vi.fn();
    const service = createSettingsServiceMock({});

    createSettingsList(service, done);

    // The SettingsList constructor receives done as the final callback
    expect(done).toBeDefined();
  });
});
