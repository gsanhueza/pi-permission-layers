/**
 * Tests for hasInteractiveUI with forceUI setting
 *
 * Run with: npm test
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

// Mock getCachedConfig before importing hasInteractiveUI
const mockCachedConfig = vi.fn();
vi.mock("../src/core/tools", async () => {
  const actual = await vi.importActual("../src/core/tools");
  return {
    ...actual,
    getCachedConfig: (...args: unknown[]) => mockCachedConfig(...args),
  };
});

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { hasInteractiveUI } from "../src/ui/ui";

// ============================================================================
// HELPERS
// ============================================================================

const makeCtx = (overrides: Partial<ExtensionContext> = {}): ExtensionContext =>
  ({
    ui: {} as ExtensionContext["ui"],
    hasUI: false,
    cwd: ".",
    ...overrides,
  }) as ExtensionContext;

// ============================================================================
// forceUI = false (default) — unchanged behavior
// ============================================================================

describe("hasInteractiveUI: forceUI false — unchanged behavior", () => {
  beforeEach(() => {
    mockCachedConfig.mockReturnValue({ forceUI: false });
  });

  test("returns false when ctx has no UI", () => {
    const ctx = makeCtx();
    expect(hasInteractiveUI(ctx)).toBe(false);
  });

  test("returns true when ctx has UI and no mode override", () => {
    const ctx = makeCtx({ hasUI: true });
    expect(hasInteractiveUI(ctx)).toBe(true);
  });

  test("returns false when mode is print", () => {
    const originalArgv = process.argv;
    process.argv = ["node", "pi", "--mode=print"];
    try {
      const ctx = makeCtx({ hasUI: true });
      expect(hasInteractiveUI(ctx)).toBe(false);
    } finally {
      process.argv = originalArgv;
    }
  });
});

// ============================================================================
// forceUI = true — forces interactive UI
// ============================================================================

describe("hasInteractiveUI: forceUI true — forces interactive", () => {
  beforeEach(() => {
    mockCachedConfig.mockReturnValue({ forceUI: true });
  });

  test("returns true even when ctx has no UI", () => {
    const ctx = makeCtx();
    expect(hasInteractiveUI(ctx)).toBe(true);
  });

  test("returns true even when mode is print", () => {
    const originalArgv = process.argv;
    process.argv = ["node", "pi", "--mode=print"];
    try {
      const ctx = makeCtx({ hasUI: true });
      expect(hasInteractiveUI(ctx)).toBe(true);
    } finally {
      process.argv = originalArgv;
    }
  });

  test("returns true even when ctx has no UI and mode is print", () => {
    const originalArgv = process.argv;
    process.argv = ["node", "pi", "--mode=print"];
    try {
      const ctx = makeCtx();
      expect(hasInteractiveUI(ctx)).toBe(true);
    } finally {
      process.argv = originalArgv;
    }
  });
});

// ============================================================================
// forceUI = undefined — falls through to normal logic
// ============================================================================

describe("hasInteractiveUI: forceUI undefined — falls through", () => {
  beforeEach(() => {
    mockCachedConfig.mockReturnValue({});
  });

  test("returns false when ctx has no UI", () => {
    const ctx = makeCtx();
    expect(hasInteractiveUI(ctx)).toBe(false);
  });

  test("returns true when ctx has UI", () => {
    const ctx = makeCtx({ hasUI: true });
    expect(hasInteractiveUI(ctx)).toBe(true);
  });
});
