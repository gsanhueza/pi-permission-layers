/**
 * Tests for strategy hooks — onViewLevel, onSetLevel, onViewMode, onSetMode.
 *
 * Run with: npm test
 */

import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  CANCEL,
  getPiCodingAgentMock,
  getSettingsMock,
  makeCtx,
} from "./fixtures/helpers";

vi.mock("../src/core/settings", () =>
  getSettingsMock({
    loadGlobalPermissionLevel: () => null,
    loadGlobalPermissionMode: () => null,
    saveGlobalPermissionLevel: vi.fn(),
    saveGlobalPermissionMode: vi.fn(),
  }),
);

vi.mock("@earendil-works/pi-coding-agent", () => getPiCodingAgentMock());

import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { UIPermissionStrategy } from "../src/strategies/ui-strategy";
import type { NotifyCall, SelectCall } from "./fixtures/helpers";

// Extended context type with test-tracking properties
interface TestCommandContext extends ExtensionCommandContext {
  selectCalls: SelectCall[];
  notifyCalls: NotifyCall[];
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================================
// onViewLevel
// ============================================================================

describe("UIPermissionStrategy: onViewLevel", () => {
  test("calls ctx.ui.select with level options", async () => {
    const strategy = new UIPermissionStrategy();
    const ctx = makeCtx() as unknown as TestCommandContext;

    await (strategy as any).onViewLevel(ctx);

    expect(ctx.selectCalls.length).toBe(1);
    expect(ctx.selectCalls[0].message).toBe("Select permission level");
    const options = ctx.selectCalls[0].options;
    expect(options).toContain("Minimal: Read-only ← current");
    expect(options).toContain("Low: File ops only");
    expect(options).toContain("Medium: Dev operations");
    expect(options).toContain("High: Full operations");
    expect(options).toContain("Bypassed: All checks disabled");
  });

  test("selecting a level updates state", async () => {
    const strategy = new UIPermissionStrategy();
    // First select: "Low: File ops only"
    // Second select: "Session only"
    const ctx = makeCtx("Session only");
    let callCount = 0;
    ctx.ui.select = async (message: string, options: string[]) => {
      callCount++;
      if (callCount === 1) {
        // Find and return "Low: File ops only"
        const lowOpt = options.find((o) => o.startsWith("Low:"));
        return lowOpt || undefined;
      }
      return "Session only";
    };

    await (strategy as any).onViewLevel(ctx as unknown as TestCommandContext);

    expect(strategy.state.currentLevel).toBe("low");
  });

  test("selecting a level with global save", async () => {
    const strategy = new UIPermissionStrategy();
    const ctx = makeCtx("Global (persists)");
    let callCount = 0;
    ctx.ui.select = async (message: string, options: string[]) => {
      callCount++;
      if (callCount === 1) {
        const mediumOpt = options.find((o) => o.startsWith("Medium:"));
        return mediumOpt || undefined;
      }
      return "Global (persists)";
    };

    await (strategy as any).onViewLevel(ctx as unknown as TestCommandContext);

    expect(strategy.state.currentLevel).toBe("medium");
    expect(strategy.state.isSessionOnly).toBe(false);
  });

  test("canceling first select does nothing", async () => {
    const strategy = new UIPermissionStrategy();
    const ctx = makeCtx("Cancel");

    await (strategy as any).onViewLevel(ctx as unknown as TestCommandContext);

    expect(strategy.state.currentLevel).toBe("minimal");
  });

  test("canceling second select does nothing", async () => {
    const strategy = new UIPermissionStrategy();
    const ctx = makeCtx("Cancel");
    let callCount = 0;
    ctx.ui.select = async (message: string, options: string[]) => {
      callCount++;
      if (callCount === 1) {
        const highOpt = options.find((o) => o.startsWith("High:"));
        return highOpt || undefined;
      }
      return undefined;
    };

    await (strategy as any).onViewLevel(ctx as unknown as TestCommandContext);

    expect(strategy.state.currentLevel).toBe("minimal");
  });
});

// ============================================================================
// onSetLevel
// ============================================================================

describe("UIPermissionStrategy: onSetLevel", () => {
  test("calls ctx.ui.select for scope", async () => {
    const strategy = new UIPermissionStrategy();
    const ctx = makeCtx("Session only") as unknown as TestCommandContext;

    await (strategy as any).onSetLevel("high", ctx);

    expect(ctx.selectCalls.length).toBe(1);
    expect(ctx.selectCalls[0].message).toBe("Save permission level to:");
    expect(ctx.selectCalls[0].options).toContain("Session only");
    expect(ctx.selectCalls[0].options).toContain("Global (persists)");
  });

  test("session-only scope sets isSessionOnly: true", async () => {
    const strategy = new UIPermissionStrategy();
    const ctx = makeCtx("Session only") as unknown as TestCommandContext;

    await (strategy as any).onSetLevel("high", ctx);

    expect(strategy.state.currentLevel).toBe("high");
    expect(strategy.state.isSessionOnly).toBe(true);
  });

  test("global scope sets isSessionOnly: false", async () => {
    const strategy = new UIPermissionStrategy();
    const ctx = makeCtx("Global (persists)") as unknown as TestCommandContext;

    await (strategy as any).onSetLevel("medium", ctx);

    expect(strategy.state.currentLevel).toBe("medium");
    expect(strategy.state.isSessionOnly).toBe(false);
  });

  test("canceling scope selection does nothing", async () => {
    const strategy = new UIPermissionStrategy();
    const ctx = makeCtx(CANCEL) as unknown as TestCommandContext;

    await (strategy as any).onSetLevel("high", ctx);

    expect(strategy.state.currentLevel).toBe("minimal");
    expect(strategy.state.isSessionOnly).toBe(false);
  });
});

// ============================================================================
// onViewMode
// ============================================================================

describe("UIPermissionStrategy: onViewMode", () => {
  test("calls ctx.ui.select with mode options", async () => {
    const strategy = new UIPermissionStrategy();
    const ctx = makeCtx() as unknown as TestCommandContext;

    await (strategy as any).onViewMode(ctx);

    expect(ctx.selectCalls.length).toBe(1);
    expect(ctx.selectCalls[0].message).toBe("Select permission mode");
    const options = ctx.selectCalls[0].options;
    expect(options).toContain(
      "Ask: Prompt when permission is required ← current",
    );
    expect(options).toContain("Block: Block instead of prompting");
  });

  test("selecting a mode updates state", async () => {
    const strategy = new UIPermissionStrategy();
    const ctx = makeCtx("Session only");
    let callCount = 0;
    ctx.ui.select = async (message: string, options: string[]) => {
      callCount++;
      if (callCount === 1) {
        const blockOpt = options.find((o) => o.startsWith("Block:"));
        return blockOpt || undefined;
      }
      return "Session only";
    };

    await (strategy as any).onViewMode(ctx as unknown as TestCommandContext);

    expect(strategy.state.permissionMode).toBe("block");
  });
});

// ============================================================================
// onSetMode
// ============================================================================

describe("UIPermissionStrategy: onSetMode", () => {
  test("calls ctx.ui.select for scope", async () => {
    const strategy = new UIPermissionStrategy();
    const ctx = makeCtx("Session only") as unknown as TestCommandContext;

    await (strategy as any).onSetMode("block", ctx);

    expect(ctx.selectCalls.length).toBe(1);
    expect(ctx.selectCalls[0].message).toBe("Save permission mode to:");
    expect(ctx.selectCalls[0].options).toContain("Session only");
    expect(ctx.selectCalls[0].options).toContain("Global (persists)");
  });

  test("session-only scope sets isModeSessionOnly: true", async () => {
    const strategy = new UIPermissionStrategy();
    const ctx = makeCtx("Session only") as unknown as TestCommandContext;

    await (strategy as any).onSetMode("block", ctx);

    expect(strategy.state.permissionMode).toBe("block");
    expect(strategy.state.isModeSessionOnly).toBe(true);
  });

  test("global scope sets isModeSessionOnly: false", async () => {
    const strategy = new UIPermissionStrategy();
    const ctx = makeCtx("Global (persists)") as unknown as TestCommandContext;

    await (strategy as any).onSetMode("ask", ctx);

    expect(strategy.state.permissionMode).toBe("ask");
    expect(strategy.state.isModeSessionOnly).toBe(false);
  });
});
