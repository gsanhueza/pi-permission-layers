/**
 * Tests for classifyAndCheck — the shared tool permission decision tree.
 *
 * Run with: npm test
 */

import { describe, expect, test } from "vitest";
import type { Classification, PermissionState } from "../src/core/interfaces";
import type { PermissionLevel } from "../src/core/types";
import { classifyAndCheck } from "../src/strategies/internal/tool-permission";

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

const makeClassification = (
  level: PermissionLevel,
  dangerous = false,
): Classification => ({ level, dangerous });

// ============================================================================
// null classification (unknown tool)
// ============================================================================

describe("classifyAndCheck: null classification (unknown tool)", () => {
  test("returns blocked with reason", () => {
    const state = makeState();
    const result = classifyAndCheck(state, null);

    expect(result.blocked).toBe(true);
    expect(result.reason).toContain("Unknown tool");
    expect(result.classification).toBeNull();
  });

  test("blocks even at high level", () => {
    const state = makeState({ currentLevel: "high" });
    const result = classifyAndCheck(state, null);

    expect(result.blocked).toBe(true);
    expect(result.classification).toBeNull();
  });
});

// ============================================================================
// dangerous classification
// ============================================================================

describe("classifyAndCheck: dangerous classification", () => {
  test("returns blocked with reason 'dangerous'", () => {
    const state = makeState();
    const classification = makeClassification("high", true);
    const result = classifyAndCheck(state, classification);

    expect(result.blocked).toBe(true);
    expect(result.reason).toBe("dangerous");
    expect(result.classification).toBe(classification);
  });

  test("dangerous blocks even at high level", () => {
    const state = makeState({ currentLevel: "high" });
    const classification = makeClassification("high", true);
    const result = classifyAndCheck(state, classification);

    expect(result.blocked).toBe(true);
    expect(result.reason).toBe("dangerous");
  });

  test("dangerous blocks at any level", () => {
    const levels: PermissionLevel[] = ["minimal", "low", "medium", "high"];
    for (const level of levels) {
      const state = makeState({ currentLevel: level });
      const classification = makeClassification("high", true);
      const result = classifyAndCheck(state, classification);

      expect(result.blocked).toBe(true);
      expect(result.reason).toBe("dangerous");
    }
  });
});

// ============================================================================
// sufficient level → not blocked
// ============================================================================

describe("classifyAndCheck: sufficient level → not blocked", () => {
  test("state level > classification level → not blocked", () => {
    const state = makeState({ currentLevel: "high" });
    const classification = makeClassification("medium");
    const result = classifyAndCheck(state, classification);

    expect(result.blocked).toBe(false);
    expect(result.classification).toBe(classification);
  });

  test("same level → not blocked", () => {
    const state = makeState({ currentLevel: "low" });
    const classification = makeClassification("low");
    const result = classifyAndCheck(state, classification);

    expect(result.blocked).toBe(false);
    expect(result.classification).toBe(classification);
  });

  test("high state allows minimal classification", () => {
    const state = makeState({ currentLevel: "high" });
    const classification = makeClassification("minimal");
    const result = classifyAndCheck(state, classification);

    expect(result.blocked).toBe(false);
  });
});

// ============================================================================
// insufficient level → not blocked (caller handles via requestPermission)
// ============================================================================

describe("classifyAndCheck: insufficient level → not blocked (caller handles)", () => {
  test("state level < classification level → not blocked", () => {
    const state = makeState({ currentLevel: "minimal" });
    const classification = makeClassification("medium");
    const result = classifyAndCheck(state, classification);

    // classifyAndCheck does NOT block on insufficient level —
    // it returns the classification so the caller can invoke requestPermission
    expect(result.blocked).toBe(false);
    expect(result.classification).toBe(classification);
  });

  test("low state < medium classification → not blocked", () => {
    const state = makeState({ currentLevel: "low" });
    const classification = makeClassification("medium");
    const result = classifyAndCheck(state, classification);

    expect(result.blocked).toBe(false);
    expect(result.classification).toBe(classification);
  });
});
