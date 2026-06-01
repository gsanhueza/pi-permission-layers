/**
 * Tests for checkPermission — the shared bypass + level comparison guard.
 *
 * Run with: npm test
 */

import { describe, expect, test } from "vitest";
import type { PermissionState } from "../src/core/interfaces";
import { checkPermission } from "../src/strategies/internal/permission-check";

// ============================================================================
// HELPERS
// ============================================================================

const makeState = (
  overrides: Partial<PermissionState> = {},
): PermissionState => ({
  currentLevel: "minimal",
  isSessionOnly: false,
  permissionMode: "ask",
  isModeSessionOnly: false,
  ...overrides,
});

// ============================================================================
// bypassed level
// ============================================================================

describe("checkPermission: bypassed level always allows", () => {
  test("bypassed allows any required level", () => {
    const state = makeState({ currentLevel: "bypassed" });

    expect(checkPermission(state, "minimal")).toBe(true);
    expect(checkPermission(state, "low")).toBe(true);
    expect(checkPermission(state, "medium")).toBe(true);
    expect(checkPermission(state, "high")).toBe(true);
    expect(checkPermission(state, "bypassed")).toBe(true);
  });
});

// ============================================================================
// level comparison
// ============================================================================

describe("checkPermission: same level → allowed", () => {
  test("minimal = minimal", () => {
    expect(
      checkPermission(makeState({ currentLevel: "minimal" }), "minimal"),
    ).toBe(true);
  });

  test("low = low", () => {
    expect(checkPermission(makeState({ currentLevel: "low" }), "low")).toBe(
      true,
    );
  });

  test("medium = medium", () => {
    expect(
      checkPermission(makeState({ currentLevel: "medium" }), "medium"),
    ).toBe(true);
  });

  test("high = high", () => {
    expect(checkPermission(makeState({ currentLevel: "high" }), "high")).toBe(
      true,
    );
  });
});

describe("checkPermission: higher level → allowed", () => {
  test("high allows everything", () => {
    const state = makeState({ currentLevel: "high" });
    expect(checkPermission(state, "minimal")).toBe(true);
    expect(checkPermission(state, "low")).toBe(true);
    expect(checkPermission(state, "medium")).toBe(true);
    expect(checkPermission(state, "high")).toBe(true);
  });

  test("medium allows minimal and low", () => {
    const state = makeState({ currentLevel: "medium" });
    expect(checkPermission(state, "minimal")).toBe(true);
    expect(checkPermission(state, "low")).toBe(true);
  });

  test("low allows minimal", () => {
    const state = makeState({ currentLevel: "low" });
    expect(checkPermission(state, "minimal")).toBe(true);
  });
});

describe("checkPermission: lower level → blocked", () => {
  test("minimal blocks everything above", () => {
    const state = makeState({ currentLevel: "minimal" });
    expect(checkPermission(state, "low")).toBe(false);
    expect(checkPermission(state, "medium")).toBe(false);
    expect(checkPermission(state, "high")).toBe(false);
  });

  test("low blocks medium and high", () => {
    const state = makeState({ currentLevel: "low" });
    expect(checkPermission(state, "medium")).toBe(false);
    expect(checkPermission(state, "high")).toBe(false);
  });

  test("medium blocks high", () => {
    const state = makeState({ currentLevel: "medium" });
    expect(checkPermission(state, "high")).toBe(false);
  });
});
