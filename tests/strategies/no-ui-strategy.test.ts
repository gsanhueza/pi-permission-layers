/**
 * Tests for isSessionOnly behavior — session-only vs global persistence.
 *
 * Run with: npm test
 */

import { beforeEach, describe, expect, test, vi } from "vitest";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
  createNoUIPermissionStrategy,
  createUIPermissionStrategy,
} from "../mocks/strategy-factory";

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================================
// NoUIPermissionStrategy — always session-only
// ============================================================================

describe("NoUIPermissionStrategy: setLevel always session-only", () => {
  test("saveGlobally: true still sets isSessionOnly: true", () => {
    const strategy = createNoUIPermissionStrategy();

    strategy.setLevel("medium", true, {} as ExtensionContext);
    expect(strategy.state.currentLevel).toBe("medium");
    expect(strategy.state.isSessionOnly).toBe(true);
  });
});

describe("NoUIPermissionStrategy: setMode always session-only", () => {
  test("saveGlobally: true still sets isModeSessionOnly: true", () => {
    const strategy = createNoUIPermissionStrategy();

    strategy.setMode("ask", true);
    expect(strategy.state.permissionMode).toBe("ask");
    expect(strategy.state.isModeSessionOnly).toBe(true);
  });
});

describe("NoUIPermissionStrategy: session state init", () => {
  test("starts with minimal level and ask mode", () => {
    const strategy = createNoUIPermissionStrategy();

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
    const strategy = createUIPermissionStrategy();

    expect(strategy.state.currentLevel).toBe("minimal");
    expect(strategy.state.permissionMode).toBe("ask");
    expect(strategy.state.isSessionOnly).toBe(false);
    expect(strategy.state.isModeSessionOnly).toBe(false);
  });
});

describe("UIPermissionStrategy: setLevel with saveGlobally", () => {
  test("saveGlobally: true sets isSessionOnly: false", () => {
    const saveLevel = vi.fn();
    const strategy = createUIPermissionStrategy({ saveLevel });

    strategy.setLevel("high", true, {} as ExtensionContext);
    expect(strategy.state.currentLevel).toBe("high");
    expect(strategy.state.isSessionOnly).toBe(false);
    expect(saveLevel).toHaveBeenCalledWith("high");
  });

  test("saveGlobally: false sets isSessionOnly: true", () => {
    const saveLevel = vi.fn();
    const strategy = createUIPermissionStrategy({ saveLevel });

    strategy.setLevel("low", false, {} as ExtensionContext);
    expect(strategy.state.currentLevel).toBe("low");
    expect(strategy.state.isSessionOnly).toBe(true);
    expect(saveLevel).not.toHaveBeenCalled();
  });
});

describe("UIPermissionStrategy: setMode with saveGlobally", () => {
  test("saveGlobally: true sets isModeSessionOnly: false", () => {
    const saveMode = vi.fn();
    const strategy = createUIPermissionStrategy({ saveMode });

    strategy.setMode("ask", true);
    expect(strategy.state.permissionMode).toBe("ask");
    expect(strategy.state.isModeSessionOnly).toBe(false);
    expect(saveMode).toHaveBeenCalledWith("ask");
  });

  test("saveGlobally: false sets isModeSessionOnly: true", () => {
    const saveMode = vi.fn();
    const strategy = createUIPermissionStrategy({ saveMode });

    strategy.setMode("block", false);
    expect(strategy.state.permissionMode).toBe("block");
    expect(strategy.state.isModeSessionOnly).toBe(true);
    expect(saveMode).not.toHaveBeenCalled();
  });
});
