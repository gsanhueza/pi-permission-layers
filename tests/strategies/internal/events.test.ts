/**
 * Tests for initializeSessionState — session initialization from env/global settings.
 *
 * Run with: npm test
 */

import { beforeEach, describe, expect, test } from "vitest";
import { initializeSessionState } from "../../../src/strategies/internal/events";
import type { SettingsService } from "../../../src/core/settings";

// ============================================================================
// MOCKS
// ============================================================================

function createSettingsServiceMock(
  level: string | null = null,
  mode: string | null = null,
): SettingsService {
  return {
    getPermissionConfig: () => ({}),
    savePermissionConfig: () => {},
    clearCache: () => {},
    loadGlobalPermissionLevel: () => level,
    loadGlobalPermissionMode: () => mode,
    saveGlobalPermissionLevel: () => {},
    saveGlobalPermissionMode: () => {},
  } as unknown as SettingsService;
}

// ============================================================================
// environment variable override
// ============================================================================

describe("initializeSessionState: PI_PERMISSION_LEVEL env var", () => {
  beforeEach(() => {
    delete process.env.PI_PERMISSION_LEVEL;
  });

  test("uses env var level when set", () => {
    process.env.PI_PERMISSION_LEVEL = "high";
    const state = {
      currentLevel: "minimal" as const,
      isSessionOnly: false,
      permissionMode: "ask" as const,
      isModeSessionOnly: false,
    };
    const service = createSettingsServiceMock("medium", "block");

    initializeSessionState(state, service);

    expect(state.currentLevel).toBe("high");
  });

  test("uses env var level case-insensitively", () => {
    process.env.PI_PERMISSION_LEVEL = "MEDIUM";
    const state = {
      currentLevel: "minimal" as const,
      isSessionOnly: false,
      permissionMode: "ask" as const,
      isModeSessionOnly: false,
    };
    const service = createSettingsServiceMock("high", "block");

    initializeSessionState(state, service);

    expect(state.currentLevel).toBe("medium");
  });

  test("ignores invalid env var level", () => {
    process.env.PI_PERMISSION_LEVEL = "banana";
    const state = {
      currentLevel: "minimal" as const,
      isSessionOnly: false,
      permissionMode: "ask" as const,
      isModeSessionOnly: false,
    };
    const service = createSettingsServiceMock("high", "block");

    initializeSessionState(state, service);

    expect(state.currentLevel).toBe("high");
  });

  test("falls back to global level when env var not set", () => {
    const state = {
      currentLevel: "minimal" as const,
      isSessionOnly: false,
      permissionMode: "ask" as const,
      isModeSessionOnly: false,
    };
    const service = createSettingsServiceMock("bypassed", "ask");

    initializeSessionState(state, service);

    expect(state.currentLevel).toBe("bypassed");
  });

  test("stays at default when no env var and no global level", () => {
    const state = {
      currentLevel: "minimal" as const,
      isSessionOnly: false,
      permissionMode: "ask" as const,
      isModeSessionOnly: false,
    };
    const service = createSettingsServiceMock(null, "block");

    initializeSessionState(state, service);

    expect(state.currentLevel).toBe("minimal");
  });
});

// ============================================================================
// global mode override
// ============================================================================

describe("initializeSessionState: global mode", () => {
  test("uses global mode when set", () => {
    const state = {
      currentLevel: "minimal" as const,
      isSessionOnly: false,
      permissionMode: "ask" as const,
      isModeSessionOnly: false,
    };
    const service = createSettingsServiceMock("low", "block");

    initializeSessionState(state, service);

    expect(state.permissionMode).toBe("block");
  });

  test("does not override when global mode is null", () => {
    const state = {
      currentLevel: "minimal" as const,
      isSessionOnly: false,
      permissionMode: "ask" as const,
      isModeSessionOnly: false,
    };
    const service = createSettingsServiceMock("low", null);

    initializeSessionState(state, service);

    expect(state.permissionMode).toBe("ask");
  });
});
