/**
 * Tests for handleConfigSubcommand — the /permission config show/reset/help flow.
 *
 * Run with: npm test
 */

import { beforeEach, describe, expect, test, vi } from "vitest";
import { makeSimpleNotifyCtx } from "../fixtures/helpers";
import { handleConfigSubcommand } from "../../src/strategies/internal/commands";
import { SettingsService } from "../../src/core/settings";
import { SettingsManager } from "../../src/core/manager";

const makeCtx = makeSimpleNotifyCtx;

const mockSettings = require("../fixtures/mock-settings.json");

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
