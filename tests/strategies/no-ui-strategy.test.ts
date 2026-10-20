/**
 * Tests for isSessionOnly behavior — session-only vs global persistence.
 *
 * Run with: npm test
 */

import { beforeEach, describe, expect, test, vi } from "vitest";
import { getPiCodingAgentMock } from "../fixtures/helpers";
import { settingsMock } from "../mocks/settings";

vi.mock("@earendil-works/pi-coding-agent", () => getPiCodingAgentMock());

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { BaseStrategyDeps } from "../../src/strategies/base-strategy";
import { NoUIPermissionStrategy } from "../../src/strategies/no-ui-strategy";
import { UIPermissionStrategy } from "../../src/strategies/ui-strategy";

// Default deps for strategy tests
const createDeps = (): BaseStrategyDeps => ({
  getCachedConfig: () =>
    (settingsMock.loadPermissionConfig as () => Record<string, unknown>)(),
  saveGlobalPermissionLevel: () => {},
  saveGlobalPermissionMode: () => {},
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================================
// NoUIPermissionStrategy — always session-only
// ============================================================================

describe("NoUIPermissionStrategy: setLevel always session-only", () => {
  test("saveGlobally: true still sets isSessionOnly: true", () => {
    const strategy = new NoUIPermissionStrategy(createDeps());

    strategy.setLevel("medium", true, {} as ExtensionContext);
    expect(strategy.state.currentLevel).toBe("medium");
    expect(strategy.state.isSessionOnly).toBe(true);
  });
});

describe("NoUIPermissionStrategy: setMode always session-only", () => {
  test("saveGlobally: true still sets isModeSessionOnly: true", () => {
    const strategy = new NoUIPermissionStrategy(createDeps());

    strategy.setMode("ask", true);
    expect(strategy.state.permissionMode).toBe("ask");
    expect(strategy.state.isModeSessionOnly).toBe(true);
  });
});

describe("NoUIPermissionStrategy: session state init", () => {
  test("starts with minimal level and ask mode", () => {
    const strategy = new NoUIPermissionStrategy(createDeps());

    expect(strategy.state.currentLevel).toBe("minimal");
    expect(strategy.state.permissionMode).toBe("ask");
    expect(strategy.state.isSessionOnly).toBe(false);
    expect(strategy.state.isModeSessionOnly).toBe(false);
  });
});

// ============================================================================
// UIPermissionStrategy — delegates to base, tests session behavior
// ============================================================================

describe("UIPermissionStrategy: session state init", () => {
  test("starts with minimal level and ask mode", () => {
    const strategy = new UIPermissionStrategy(createDeps());

    expect(strategy.state.currentLevel).toBe("minimal");
    expect(strategy.state.permissionMode).toBe("ask");
    expect(strategy.state.isSessionOnly).toBe(false);
    expect(strategy.state.isModeSessionOnly).toBe(false);
  });
});

describe("UIPermissionStrategy: setLevel with saveGlobally", () => {
  test("saveGlobally: true sets isSessionOnly: false", () => {
    const saveLevel = vi.fn();
    const deps: BaseStrategyDeps = {
      ...createDeps(),
      saveGlobalPermissionLevel: saveLevel,
    };
    const strategy = new UIPermissionStrategy(deps);

    strategy.setLevel("high", true, {} as ExtensionContext);
    expect(strategy.state.currentLevel).toBe("high");
    expect(strategy.state.isSessionOnly).toBe(false);
    expect(saveLevel).toHaveBeenCalledWith("high");
  });

  test("saveGlobally: false sets isSessionOnly: true", () => {
    const saveLevel = vi.fn();
    const deps: BaseStrategyDeps = {
      ...createDeps(),
      saveGlobalPermissionLevel: saveLevel,
    };
    const strategy = new UIPermissionStrategy(deps);

    strategy.setLevel("low", false, {} as ExtensionContext);
    expect(strategy.state.currentLevel).toBe("low");
    expect(strategy.state.isSessionOnly).toBe(true);
    expect(saveLevel).not.toHaveBeenCalled();
  });
});

describe("UIPermissionStrategy: setMode with saveGlobally", () => {
  test("saveGlobally: true sets isModeSessionOnly: false", () => {
    const saveMode = vi.fn();
    const deps: BaseStrategyDeps = {
      ...createDeps(),
      saveGlobalPermissionMode: saveMode,
    };
    const strategy = new UIPermissionStrategy(deps);

    strategy.setMode("ask", true);
    expect(strategy.state.permissionMode).toBe("ask");
    expect(strategy.state.isModeSessionOnly).toBe(false);
    expect(saveMode).toHaveBeenCalledWith("ask");
  });

  test("saveGlobally: false sets isModeSessionOnly: true", () => {
    const saveMode = vi.fn();
    const deps: BaseStrategyDeps = {
      ...createDeps(),
      saveGlobalPermissionMode: saveMode,
    };
    const strategy = new UIPermissionStrategy(deps);

    strategy.setMode("block", false);
    expect(strategy.state.permissionMode).toBe("block");
    expect(strategy.state.isModeSessionOnly).toBe(true);
    expect(saveMode).not.toHaveBeenCalled();
  });
});
