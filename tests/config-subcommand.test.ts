/**
 * Tests for handleConfigSubcommand — the /permission config show/reset/help flow.
 *
 * Run with: npm test
 */

import { beforeEach, describe, expect, test, vi } from "vitest";
import { getSettingsMock, makeSimpleNotifyCtx } from "./fixtures/helpers";

const makeCtx = makeSimpleNotifyCtx;

vi.mock("../src/core/settings", () =>
  getSettingsMock({ savePermissionConfig: vi.fn() }),
);
vi.mock("../src/core/config", () => ({
  invalidateConfigCache: vi.fn(),
}));

import { handleConfigSubcommand } from "../src/strategies/internal/commands";

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================================
// config show
// ============================================================================

describe("handleConfigSubcommand: config show", () => {
  test("calls notify with config content", async () => {
    const ctx = makeCtx();

    await handleConfigSubcommand("show", ctx as never);

    expect(ctx.calls.length).toBe(1);
    expect(ctx.calls[0].level).toBe("info");
    expect(ctx.calls[0].message).toContain("Permission Config:");
    expect(ctx.calls[0].message).toContain("quietStartup");
    expect(ctx.calls[0].message).toContain("forceUI");
    expect(ctx.calls[0].message).toContain("systemNotifications");
  });

  test("calls notify with empty config when none set", async () => {
    vi.mocked(await import("../src/core/settings.js")).savePermissionConfig;
    const ctx = makeCtx();

    await handleConfigSubcommand("show", ctx as never);

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

    await handleConfigSubcommand("reset", ctx as never);

    expect(ctx.calls.length).toBe(1);
    expect(ctx.calls[0].level).toBe("info");
    expect(ctx.calls[0].message).toBe("Permission config reset to defaults");
  });

  test("calls savePermissionConfig with empty object", async () => {
    const { savePermissionConfig } = await import("../src/core/settings.js");
    const ctx = makeCtx();

    await handleConfigSubcommand("reset", ctx as never);

    expect(savePermissionConfig).toHaveBeenCalledWith({});
  });
});

// ============================================================================
// config help (unknown subcommand)
// ============================================================================

describe("handleConfigSubcommand: unknown subcommand → help text", () => {
  test("unknown action shows help text", async () => {
    const ctx = makeCtx();

    await handleConfigSubcommand("foobar", ctx as never);

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

    await handleConfigSubcommand("", ctx as never);

    expect(ctx.calls.length).toBe(1);
    expect(ctx.calls[0].level).toBe("info");
    expect(ctx.calls[0].message).toContain(
      "Usage: /permission config <action>",
    );
  });

  test("whitespace-only args shows help text", async () => {
    const ctx = makeCtx();

    await handleConfigSubcommand("   ", ctx as never);

    expect(ctx.calls.length).toBe(1);
    expect(ctx.calls[0].level).toBe("info");
    expect(ctx.calls[0].message).toContain(
      "Usage: /permission config <action>",
    );
  });
});
