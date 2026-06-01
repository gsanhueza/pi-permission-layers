/**
 * Tests for hasInteractiveUI with forceUI setting
 *
 * Run with: npm test
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import { getSettingsMock, withArgv } from "./fixtures/helpers";

vi.mock("../src/core/settings", () => getSettingsMock());

// Mock getCachedConfig before importing hasInteractiveUI
const mockCachedConfig = vi.fn();
vi.mock("../src/core/config", async () => {
  const actual = await vi.importActual("../src/core/config");
  return {
    ...actual,
    getCachedConfig: (...args: unknown[]) => mockCachedConfig(...args),
  };
});

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { hasInteractiveUI } from "../src/strategies/internal/ui-detection";

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
    expect(
      withArgv(["node", "pi", "--mode=print"], () =>
        hasInteractiveUI(makeCtx({ hasUI: true })),
      ),
    ).toBe(false);
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
    expect(
      withArgv(["node", "pi", "--mode=print"], () =>
        hasInteractiveUI(makeCtx({ hasUI: true })),
      ),
    ).toBe(true);
  });

  test("returns true even when ctx has no UI and mode is print", () => {
    expect(
      withArgv(["node", "pi", "--mode=print"], () =>
        hasInteractiveUI(makeCtx()),
      ),
    ).toBe(true);
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
