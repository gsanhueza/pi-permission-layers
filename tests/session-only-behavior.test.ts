/**
 * Tests for isSessionOnly behavior — session-only vs global persistence.
 *
 * Run with: npm test
 */

import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  getPiCodingAgentMock,
  getSettingsMock,
  makeCtx,
} from "./fixtures/helpers";

vi.mock("../src/core/settings", () =>
  getSettingsMock({
    loadGlobalPermissionLevel: () => null,
    loadGlobalPermissionMode: () => null,
    saveGlobalPermissionLevel: () => {},
    saveGlobalPermissionMode: () => {},
  }),
);

vi.mock("@earendil-works/pi-coding-agent", () => getPiCodingAgentMock());

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { NoUIPermissionStrategy } from "../src/strategies/no-ui-strategy";
import { UIPermissionStrategy } from "../src/strategies/ui-strategy";

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================================
// NoUIPermissionStrategy — always session-only
// ============================================================================

describe("NoUIPermissionStrategy: setLevel always session-only", () => {
  test("saveGlobally: true still sets isSessionOnly: true", () => {
    const strategy = new NoUIPermissionStrategy();

    strategy.setLevel("medium", true, {} as ExtensionContext);
    expect(strategy.state.currentLevel).toBe("medium");
    expect(strategy.state.isSessionOnly).toBe(true);
  });

  test("saveGlobally: false also sets isSessionOnly: true", () => {
    const strategy = new NoUIPermissionStrategy();

    strategy.setLevel("high", false, {} as ExtensionContext);
    expect(strategy.state.currentLevel).toBe("high");
    expect(strategy.state.isSessionOnly).toBe(true);
  });

  test("multiple setLevel calls all session-only", () => {
    const strategy = new NoUIPermissionStrategy();

    strategy.setLevel("low", true, {} as ExtensionContext);
    expect(strategy.state.isSessionOnly).toBe(true);

    strategy.setLevel("medium", true, {} as ExtensionContext);
    expect(strategy.state.isSessionOnly).toBe(true);

    strategy.setLevel("high", false, {} as ExtensionContext);
    expect(strategy.state.isSessionOnly).toBe(true);
  });
});

// ============================================================================
// UIPermissionStrategy — respects saveGlobally
// ============================================================================

describe("UIPermissionStrategy: setLevel respects saveGlobally", () => {
  test("saveGlobally: false → isSessionOnly: true", () => {
    const strategy = new UIPermissionStrategy();
    const ctx = makeCtx() as unknown as ExtensionContext;

    strategy.setLevel("medium", false, ctx);
    expect(strategy.state.isSessionOnly).toBe(true);
  });

  test("saveGlobally: true → isSessionOnly: false", () => {
    const strategy = new UIPermissionStrategy();
    const ctx = makeCtx() as unknown as ExtensionContext;

    strategy.setLevel("high", true, ctx);
    expect(strategy.state.isSessionOnly).toBe(false);
  });

  test("toggle between session-only and global", () => {
    const strategy = new UIPermissionStrategy();
    const ctx = makeCtx() as unknown as ExtensionContext;

    strategy.setLevel("medium", false, ctx);
    expect(strategy.state.isSessionOnly).toBe(true);

    strategy.setLevel("medium", true, ctx);
    expect(strategy.state.isSessionOnly).toBe(false);

    strategy.setLevel("medium", false, ctx);
    expect(strategy.state.isSessionOnly).toBe(true);
  });
});

// ============================================================================
// Allow all → session-only state change
// ============================================================================

describe("Allow all: session-only state change", () => {
  test("Allow all High → state updated, isSessionOnly: true", async () => {
    const strategy = new UIPermissionStrategy();
    const ctx = makeCtx("Allow all High (session)");

    await strategy.handleBashToolCall("git push", ctx as never);

    expect(strategy.state.currentLevel).toBe("high");
    expect(strategy.state.isSessionOnly).toBe(true);
  });

  test("Allow all Medium → state updated, isSessionOnly: true", async () => {
    const strategy = new UIPermissionStrategy();
    const ctx = makeCtx("Allow all Medium (session)");

    await strategy.handleBashToolCall("npm install", ctx as never);

    expect(strategy.state.currentLevel).toBe("medium");
    expect(strategy.state.isSessionOnly).toBe(true);
  });

  test("Allow all Low → state updated, isSessionOnly: true", async () => {
    const strategy = new UIPermissionStrategy();
    const ctx = makeCtx("Allow all Low (session)");

    await strategy.handleWriteToolCall("write", "/tmp/file.txt", ctx as never);

    expect(strategy.state.currentLevel).toBe("low");
    expect(strategy.state.isSessionOnly).toBe(true);
  });
});

describe("Allow all: next call at that level passes without prompt", () => {
  test("Allow all High → git push passes without prompt", async () => {
    const strategy = new UIPermissionStrategy();
    const ctx1 = makeCtx("Allow all High (session)");

    await strategy.handleBashToolCall("git push", ctx1 as never);
    expect(strategy.state.currentLevel).toBe("high");

    const ctx2 = makeCtx("Cancel");
    const result = await strategy.handleBashToolCall(
      "git push origin main",
      ctx2 as never,
    );

    expect(result).toBeUndefined();
    expect(ctx2.selectCalls.length).toBe(0);
  });

  test("Allow all Medium → npm install passes without prompt", async () => {
    const strategy = new UIPermissionStrategy();
    const ctx1 = makeCtx("Allow all Medium (session)");

    await strategy.handleBashToolCall("npm install", ctx1 as never);
    expect(strategy.state.currentLevel).toBe("medium");

    const ctx2 = makeCtx("Cancel");
    const result = await strategy.handleBashToolCall(
      "npm install lodash",
      ctx2 as never,
    );

    expect(result).toBeUndefined();
    expect(ctx2.selectCalls.length).toBe(0);
  });
});

// ============================================================================
// Allow once — does NOT change state
// ============================================================================

describe("Allow once: state unchanged", () => {
  test("Allow once → currentLevel stays minimal", async () => {
    const strategy = new UIPermissionStrategy();
    const ctx = makeCtx("Allow once");

    await strategy.handleBashToolCall("git push", ctx as never);

    expect(strategy.state.currentLevel).toBe("minimal");
    expect(strategy.state.isSessionOnly).toBe(false);
  });

  test("Allow once → next call still prompts", async () => {
    const strategy = new UIPermissionStrategy();
    const ctx1 = makeCtx("Allow once");

    await strategy.handleBashToolCall("git push", ctx1 as never);
    expect(strategy.state.currentLevel).toBe("minimal");

    const ctx2 = makeCtx("Cancel");
    const result = await strategy.handleBashToolCall("git push", ctx2 as never);

    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
  });

  test("Allow once → no notify, state unchanged", async () => {
    const strategy = new UIPermissionStrategy();
    const ctx = makeCtx("Allow once");

    await strategy.handleBashToolCall("git push", ctx as never);

    // Allow once: no notification, no state change
    expect(ctx.notifyCalls.length).toBe(0);
    expect(strategy.state.currentLevel).toBe("minimal");
    expect(strategy.state.isSessionOnly).toBe(false);
  });
});
