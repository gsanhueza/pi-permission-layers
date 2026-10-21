/**
 * Tests for hasInteractiveUI — ctx.hasUI and --mode flag behavior
 *
 * Run with: npm test
 */
import { describe, expect, test } from "vitest";
import { withArgv } from "../../mocks/argv";

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { hasInteractiveUI } from "../../../src/strategies/internal/ui-detection";

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
// ctx.hasUI = false — no UI available
// ============================================================================

describe("hasInteractiveUI: ctx.hasUI false — returns false", () => {
  test("returns false when ctx has no UI", () => {
    const ctx = makeCtx();
    expect(hasInteractiveUI(ctx)).toBe(false);
  });

  test("returns false when ctx has no UI even with no mode flag", () => {
    const ctx = makeCtx({ hasUI: false });
    expect(hasInteractiveUI(ctx)).toBe(false);
  });
});

// ============================================================================
// ctx.hasUI = true — UI available, no mode override
// ============================================================================

describe("hasInteractiveUI: ctx.hasUI true — returns true", () => {
  test("returns true when ctx has UI and no mode override", () => {
    const ctx = makeCtx({ hasUI: true });
    expect(hasInteractiveUI(ctx)).toBe(true);
  });

  test("returns true when ctx has UI with default settings", () => {
    const ctx = makeCtx({ hasUI: true });
    expect(hasInteractiveUI(ctx)).toBe(true);
  });
});

// ============================================================================
// --mode=print — overrides ctx.hasUI
// ============================================================================

describe("hasInteractiveUI: --mode=print — returns false", () => {
  test("returns false when mode is print even if ctx has UI", () => {
    expect(
      withArgv(["node", "pi", "--mode=print"], () =>
        hasInteractiveUI(makeCtx({ hasUI: true })),
      ),
    ).toBe(false);
  });

  test("returns false when mode is print and ctx has no UI", () => {
    expect(
      withArgv(["node", "pi", "--mode=print"], () =>
        hasInteractiveUI(makeCtx({ hasUI: false })),
      ),
    ).toBe(false);
  });
});

// ============================================================================
// --mode=interactive — allows UI
// ============================================================================

describe("hasInteractiveUI: --mode=interactive — returns true", () => {
  test("returns true when mode is interactive", () => {
    expect(
      withArgv(["node", "pi", "--mode=interactive"], () =>
        hasInteractiveUI(makeCtx({ hasUI: true })),
      ),
    ).toBe(true);
  });
});

// ============================================================================
// --mode with space separator
// ============================================================================

describe("hasInteractiveUI: --mode <value> — space separator", () => {
  test("returns false when mode is print (space separator)", () => {
    expect(
      withArgv(["node", "pi", "--mode", "print"], () =>
        hasInteractiveUI(makeCtx({ hasUI: true })),
      ),
    ).toBe(false);
  });
});
