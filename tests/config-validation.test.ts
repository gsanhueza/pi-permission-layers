/**
 * Tests for config validation (SettingsManager)
 *
 * Run with: npm test
 */

import { describe, expect, test } from "vitest";
import { SettingsManager } from "../src/core/manager";

// ============================================================================
// Config validation tests
// ============================================================================

describe("config validation: SettingsManager handles tools/mcp", () => {
  test("tools config is validated", () => {
    const manager = new SettingsManager("/tmp/test-settings.json");

    const validated = manager.validate({
      tools: {
        minimal: ["read", "ls"],
        low: ["write", "edit"],
        medium: ["unknown-tool"],
      },
    });

    expect(validated.tools).toBeDefined();
    expect(validated.tools!.minimal).toEqual(["read", "ls"]);
    expect(validated.tools!.low).toEqual(["write", "edit"]);
    expect(validated.tools!.medium).toEqual(["unknown-tool"]);
  });

  test("mcp config is validated", () => {
    const manager = new SettingsManager("/tmp/test-settings.json");

    const validated = manager.validate({
      mcp: {
        minimal: ["search", "describe"],
        low: ["serper_search"],
      },
    });

    expect(validated.mcp).toBeDefined();
    expect(validated.mcp!.minimal).toEqual(["search", "describe"]);
    expect(validated.mcp!.low).toEqual(["serper_search"]);
  });

  test("invalid entries filtered out", () => {
    const manager = new SettingsManager("/tmp/test-settings.json");

    const validated = manager.validate({
      tools: {
        minimal: ["read", "" as any, "ls"],
        low: [null as any],
      },
    });

    expect(validated.tools!.minimal).toEqual(["read", "ls"]);
    expect(validated.tools!.low).toBeUndefined();
  });

  test("tools cap at 100 per level", () => {
    const manager = new SettingsManager("/tmp/test-settings.json");

    const items = Array.from({ length: 150 }, (_, i) => `tool-${i}`);
    const validated = manager.validate({
      tools: {
        minimal: items,
      },
    });

    expect(validated.tools!.minimal!.length).toBe(100);
  });

  test("empty tools config returns undefined", () => {
    const manager = new SettingsManager("/tmp/test-settings.json");

    const validated = manager.validate({
      tools: {},
    });

    expect(validated.tools).toBeUndefined();
  });
});
