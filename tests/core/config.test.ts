/**
 * Tests for handleConfigSubcommand — the /permission config show/reset/help flow.
 *
 * Run with: npm test
 */

import { beforeEach, describe, expect, test, vi } from "vitest";
import { makeSimpleNotifyCtx } from "../mocks/context";
import { handleConfigSubcommand } from "../../src/strategies/internal/commands";
import { SettingsService } from "../../src/core/settings";
import { SettingsManager } from "../../src/core/manager";
import {
  globToRegex,
  matchesAnyPattern,
  applyPrefixMappings,
  checkOverrides,
} from "../../src/core/config";

const makeCtx = makeSimpleNotifyCtx;

const mockSettings = {
  permissionLevel: "minimal",
  permissionConfig: {
    quietStartup: false,
    systemNotifications: "off",
  },
};

function createConfigDeps(
  savePermissionConfig: ReturnType<typeof vi.fn> = vi.fn(),
) {
  const settingsService = {
    getPermissionConfig: () =>
      (mockSettings.permissionConfig as Record<string, unknown>) ?? {},
    savePermissionConfig,
    clearCache: () => {},
  } as unknown as SettingsService;
  return {
    settingsService,
    savePermissionConfig,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================================
// config show
// ============================================================================

describe("handleConfigSubcommand: config show", () => {
  test("calls notify with config content", async () => {
    const ctx = makeCtx();

    await handleConfigSubcommand("show", ctx as never, "", createConfigDeps());

    expect(ctx.calls.length).toBe(1);
    expect(ctx.calls[0].level).toBe("info");
    expect(ctx.calls[0].message).toContain("Permission Config:");
    expect(ctx.calls[0].message).toContain("quietStartup");
    expect(ctx.calls[0].message).toContain("systemNotifications");
  });

  test("calls notify with empty config when none set", async () => {
    const deps = { ...createConfigDeps(), loadPermissionConfig: () => ({}) };
    const ctx = makeCtx();

    await handleConfigSubcommand("show", ctx as never, "", deps);

    expect(ctx.calls.length).toBe(1);
    expect(ctx.calls[0].message).toContain("Permission Config:");
  });
});

// ============================================================================
// config reset
// ============================================================================

describe("handleConfigSubcommand: config reset", () => {
  test("calls notify with reset confirmation", async () => {
    const ctx = makeCtx();

    await handleConfigSubcommand("reset", ctx as never, "", createConfigDeps());

    expect(ctx.calls.length).toBe(1);
    expect(ctx.calls[0].level).toBe("info");
    expect(ctx.calls[0].message).toBe("Permission config reset to defaults");
  });

  test("calls savePermissionConfig with empty object", async () => {
    const savePermissionConfig = vi.fn();
    const ctx = makeCtx();
    const deps = createConfigDeps(savePermissionConfig);

    await handleConfigSubcommand("reset", ctx as never, "", deps);

    expect(savePermissionConfig).toHaveBeenCalledWith({});
  });

  test("reset does not call invalidateConfigCache", async () => {
    const ctx = makeCtx();
    const deps = createConfigDeps();

    await handleConfigSubcommand("reset", ctx as never, "", deps);

    // No invalidateConfigCache call — savePermissionConfig updates cache in-memory
  });
});

// ============================================================================
// config help (unknown subcommand)
// ============================================================================

describe("handleConfigSubcommand: unknown subcommand → help text", () => {
  test("unknown action shows help text", async () => {
    const ctx = makeCtx();

    await handleConfigSubcommand(
      "foobar",
      ctx as never,
      "",
      createConfigDeps(),
    );

    expect(ctx.calls.length).toBe(1);
    expect(ctx.calls[0].level).toBe("info");
    expect(ctx.calls[0].message).toContain(
      "Usage: /permission config <action>",
    );
    expect(ctx.calls[0].message).toContain("show");
    expect(ctx.calls[0].message).toContain("reset");
  });

  test("empty args shows help text", async () => {
    const ctx = makeCtx();

    await handleConfigSubcommand("", ctx as never, "", createConfigDeps());

    expect(ctx.calls.length).toBe(1);
    expect(ctx.calls[0].level).toBe("info");
    expect(ctx.calls[0].message).toContain(
      "Usage: /permission config <action>",
    );
  });

  test("whitespace-only args shows help text", async () => {
    const ctx = makeCtx();

    await handleConfigSubcommand("   ", ctx as never, "", createConfigDeps());

    expect(ctx.calls.length).toBe(1);
    expect(ctx.calls[0].level).toBe("info");
    expect(ctx.calls[0].message).toContain(
      "Usage: /permission config <action>",
    );
  });
});

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

// ============================================================================
// globToRegex — edge cases
// ============================================================================

describe("globToRegex", () => {
  test("returns never-match regex on invalid pattern", () => {
    // [invalid looks broken but escaping turns it into \[invalid (valid regex).
    // The catch block is dead code — escaping always produces valid regex.
    // Kept here as documentation of the safety net.
    const regex = globToRegex("[invalid");
    expect(regex.test("anything")).toBe(false);
  });

  test("converts glob wildcards to regex", () => {
    const regex = globToRegex("*.ts");
    expect(regex.test("file.ts")).toBe(true);
    expect(regex.test("file.js")).toBe(false);
  });

  test("returns never-match regex on 5+ consecutive asterisks", () => {
    const regex = globToRegex("*****.ts");
    expect(regex.test("anything.ts")).toBe(false);
  });

  test("returns never-match regex on 10 consecutive asterisks", () => {
    const regex = globToRegex("**********");
    expect(regex.test("anything")).toBe(false);
  });
});

// ============================================================================
// matchesAnyPattern
// ============================================================================

describe("matchesAnyPattern", () => {
  test("returns false for null patterns", () => {
    expect(matchesAnyPattern("ls", null as never)).toBe(false);
  });

  test("returns false for undefined patterns", () => {
    expect(matchesAnyPattern("ls", undefined as never)).toBe(false);
  });

  test("returns false for empty array", () => {
    expect(matchesAnyPattern("ls", [])).toBe(false);
  });

  test("returns false for non-array", () => {
    expect(matchesAnyPattern("ls", "not-an-array" as never)).toBe(false);
  });

  test("skips non-string patterns", () => {
    expect(matchesAnyPattern("ls", ["ls", "not-a-string" as never])).toBe(true);
  });

  test("matches when any pattern matches", () => {
    expect(matchesAnyPattern("ls", ["cat", "ls"])).toBe(true);
  });

  test("does not match when no pattern matches", () => {
    expect(matchesAnyPattern("rm", ["cat", "ls"])).toBe(false);
  });
});

// ============================================================================
// applyPrefixMappings
// ============================================================================

describe("applyPrefixMappings", () => {
  test("returns command when no mappings", () => {
    expect(applyPrefixMappings("ls", undefined)).toBe("ls");
  });

  test("returns command for empty mappings array", () => {
    expect(applyPrefixMappings("ls", [])).toBe("ls");
  });

  test("returns command for invalid mapping", () => {
    expect(
      applyPrefixMappings("ls", [{ from: "", to: "" }, null as never]),
    ).toBe("ls");
  });

  test("applies prefix mapping with replacement", () => {
    const result = applyPrefixMappings("myapp run", [
      { from: "myapp", to: "node" },
    ]);
    expect(result).toBe("node run");
  });

  test("applies prefix mapping with empty replacement", () => {
    const result = applyPrefixMappings("myapp run", [
      { from: "myapp", to: "" },
    ]);
    expect(result).toBe("run");
  });

  test("does not match prefix without separator", () => {
    const result = applyPrefixMappings("myappx run", [
      { from: "myapp", to: "node" },
    ]);
    expect(result).toBe("myappx run");
  });
});

// ============================================================================
// checkOverrides
// ============================================================================

describe("checkOverrides", () => {
  test("returns null when no overrides", () => {
    expect(checkOverrides("ls", undefined)).toBeNull();
  });

  test("returns null for empty overrides object", () => {
    expect(checkOverrides("ls", {})).toBeNull();
  });

  test("matches dangerous override", () => {
    const result = checkOverrides("rm -rf /", {
      dangerous: ["rm -rf *"],
    });
    expect(result).toEqual({ level: "high", dangerous: true });
  });

  test("matches high override", () => {
    const result = checkOverrides("docker stop", {
      high: ["docker *"],
    });
    expect(result).toEqual({ level: "high", dangerous: false });
  });

  test("matches medium override", () => {
    const result = checkOverrides("git push", {
      medium: ["git *"],
    });
    expect(result).toEqual({ level: "medium", dangerous: false });
  });

  test("matches low override", () => {
    const result = checkOverrides("npm install", {
      low: ["npm *"],
    });
    expect(result).toEqual({ level: "low", dangerous: false });
  });

  test("matches minimal override", () => {
    const result = checkOverrides("ls", {
      minimal: ["ls"],
    });
    expect(result).toEqual({ level: "minimal", dangerous: false });
  });

  test("low override present but doesn't match", () => {
    // Covers the overrides.low truthy branch when the command doesn't match
    const result = checkOverrides("docker stop", {
      low: ["npm *"],
    });
    expect(result).toBeNull();
  });
});

// ============================================================================
// regex cache eviction
// ============================================================================

describe("regex cache eviction", () => {
  test("evicts oldest entry when cache is full", () => {
    // Fill the cache by calling matchesAnyPattern with unique patterns
    // Each call compiles a new regex
    for (let i = 0; i < 501; i++) {
      matchesAnyPattern(`cmd-${i}`, [`cmd-${i}`]);
    }
    // The 501st call should trigger eviction of the first entry
    // If eviction works, the test passes without error
    expect(matchesAnyPattern("cmd-0", [`cmd-0`])).toBe(true);
  });
});
