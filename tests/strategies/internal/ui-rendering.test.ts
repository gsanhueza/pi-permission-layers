/**
 * Tests for getStatusText and isQuietMode — simple UI rendering functions.
 *
 * Run with: npm test
 */

import { describe, expect, test } from "vitest";
import { getStatusText } from "../../../src/strategies/internal/ui-rendering";

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
// isQuietMode — deferred: needs DI refactor in ui-rendering.ts
// (mocking getCachedConfig via vi.mock is fragile; see issue #XXX)
// ============================================================================
