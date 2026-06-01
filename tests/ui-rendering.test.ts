/**
 * Tests for getStatusText and isQuietMode — simple UI rendering functions.
 *
 * Run with: npm test
 */

import { beforeEach, describe, expect, test, vi } from "vitest";
import { getSettingsMock, withArgv } from "./fixtures/helpers";

vi.mock("../src/core/settings", () => getSettingsMock());

// Mock getCachedConfig before importing isQuietMode
const mockCachedConfig = vi.fn();
vi.mock("../src/core/config", async () => {
  const actual = await vi.importActual("../src/core/config");
  return {
    ...actual,
    getCachedConfig: (...args: unknown[]) => mockCachedConfig(...args),
  };
});

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
  getStatusText,
  isQuietMode,
} from "../src/strategies/internal/ui-rendering";

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

beforeEach(() => {
  vi.clearAllMocks();
  // Clean up argv between tests
  process.env.PI_QUIET = undefined;
  // Default mock: quietStartup not set
  mockCachedConfig.mockReturnValue({});
});

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

describe("isQuietMode: PI_QUIET env var", () => {
  test("PI_QUIET=1 → true", () => {
    process.env.PI_QUIET = "1";
    expect(isQuietMode(makeCtx())).toBe(true);
  });

  test("PI_QUIET=true → true", () => {
    process.env.PI_QUIET = "true";
    expect(isQuietMode(makeCtx())).toBe(true);
  });

  test("PI_QUIET=yes → true", () => {
    process.env.PI_QUIET = "yes";
    expect(isQuietMode(makeCtx())).toBe(true);
  });

  test("PI_QUIET=0 → false", () => {
    process.env.PI_QUIET = "0";
    expect(isQuietMode(makeCtx())).toBe(false);
  });

  test("PI_QUIET=invalid → false", () => {
    process.env.PI_QUIET = "invalid";
    expect(isQuietMode(makeCtx())).toBe(false);
  });

  test("PI_QUIET undefined → falls through", () => {
    delete process.env.PI_QUIET;
    expect(isQuietMode(makeCtx())).toBe(false);
  });
});

describe("isQuietMode: --quiet flag", () => {
  test("--quiet flag → true", () => {
    expect(
      withArgv(["node", "pi", "--quiet"], () => isQuietMode(makeCtx())),
    ).toBe(true);
  });

  test("-q flag → true", () => {
    expect(withArgv(["node", "pi", "-q"], () => isQuietMode(makeCtx()))).toBe(
      true,
    );
  });

  test("no quiet flag → false", () => {
    expect(withArgv(["node", "pi"], () => isQuietMode(makeCtx()))).toBe(false);
  });
});

describe("isQuietMode: quietStartup from config", () => {
  test("quietStartup: true → true", () => {
    mockCachedConfig.mockReturnValue({ quietStartup: true });
    expect(isQuietMode(makeCtx())).toBe(true);
  });

  test("quietStartup: false → false", () => {
    mockCachedConfig.mockReturnValue({ quietStartup: false });
    expect(isQuietMode(makeCtx())).toBe(false);
  });

  test("quietStartup undefined → false", () => {
    mockCachedConfig.mockReturnValue({});
    expect(isQuietMode(makeCtx())).toBe(false);
  });
});
