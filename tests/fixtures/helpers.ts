/**
 * Shared test helpers for strategy hook testing.
 *
 * Provides SelectCall, NotifyCall types and a makeCtx factory
 * used by session-only-behavior, permission-prompt, and strategy-hooks tests.
 *
 * Also provides shared mock factories and utilities used across all test files.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ============================================================================
// SHARED FIXTURE DATA
// ============================================================================

export const mockSettingsPath = resolve(__dirname, "mock-settings.json");
export const mockSettings: Record<string, unknown> = JSON.parse(
  readFileSync(mockSettingsPath, "utf-8"),
) as Record<string, unknown>;

// ============================================================================
// MOCK FACTORY HELPERS
// ============================================================================

/**
 * Build a vi.mock callback for the settings module.
 *
 * @param extra - Optional additional mock functions (e.g. savePermissionConfig).
 */
export function getSettingsMock(extra?: {
  loadGlobalPermissionLevel?: () => string | null;
  loadGlobalPermissionMode?: () => string | null;
  saveGlobalPermissionLevel?: (level: string, ctx: unknown) => void;
  saveGlobalPermissionMode?: (mode: string, ctx: unknown) => void;
  savePermissionConfig?: (config: Record<string, unknown>) => void;
}): Record<string, unknown> {
  return {
    loadPermissionConfig: () =>
      (mockSettings.permissionConfig as Record<string, unknown>) ?? {},
    ...extra,
  };
}

/**
 * Build a vi.mock callback for @earendil-works/pi-coding-agent.
 * All exports from that package are type-only, so empty objects suffice.
 */
export function getPiCodingAgentMock(): Record<string, unknown> {
  return {
    ExtensionContext: {},
    ExtensionCommandContext: {},
    ToolCallEvent: {},
  };
}

// ============================================================================
// TYPES
// ============================================================================

export interface SelectCall {
  message: string;
  options: string[];
}

export interface NotifyCall {
  message: string;
  type: string;
}

// Sentinel value to signal "cancel" (avoids JS default parameter behavior
// where makeCtx(undefined) would apply the "Cancel" default).
export const CANCEL = "__CANCEL__" as const;

// ============================================================================
// CONTEXT FACTORIES
// ============================================================================

/**
 * Create a mock context with tracked select/notify calls.
 *
 * @param selectResponse - What the select mock returns.
 *                         Use `CANCEL` to return `undefined` (cancel).
 *                         Default is `"Cancel"`.
 */
export const makeCtx = (selectResponse: string | typeof CANCEL = "Cancel") => {
  const selectCalls: SelectCall[] = [];
  const notifyCalls: NotifyCall[] = [];

  return {
    ui: {
      select: async (message: string, options: string[]) => {
        selectCalls.push({ message, options });
        return selectResponse === CANCEL ? undefined : selectResponse;
      },
      notify: (message: string, type: string) => {
        notifyCalls.push({ message, type });
      },
      setStatus: () => {},
    },
    hasUI: false,
    cwd: ".",
    selectCalls,
    notifyCalls,
  };
};

/**
 * Create a simple mock context with a tracked notify callback.
 * Used by config-subcommand tests.
 */
export const makeSimpleNotifyCtx = () => {
  const calls: { message: string; level: "info" | "warning" }[] = [];
  return {
    ui: {
      notify: (message: string, level: "info" | "warning") => {
        calls.push({ message, level });
      },
    },
    calls,
  };
};

// ============================================================================
// STRATEGY HELPERS
// ============================================================================

import type { PermissionState } from "../../src/core/interfaces";

/**
 * Reset a strategy's state to defaults.
 *
 * @param strategy - The strategy instance whose state to reset.
 */
export function resetStrategyState(strategy: { state: PermissionState }): void {
  strategy.state.currentLevel = "minimal";
  strategy.state.isSessionOnly = false;
  strategy.state.permissionMode = "ask";
  strategy.state.isModeSessionOnly = false;
}

// ============================================================================
// ARGV HELPERS
// ============================================================================

/**
 * Temporarily replace process.argv, run a callback, then restore.
 */
export function withArgv<T>(argv: string[], fn: () => T): T {
  const originalArgv = process.argv;
  process.argv = argv;
  try {
    return fn();
  } finally {
    process.argv = originalArgv;
  }
}
