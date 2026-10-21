/**
 * Context factory and types for strategy hook tests.
 *
 * Provides SelectCall, NotifyCall types and makeCtx / makeSimpleNotifyCtx
 * used by session-only-behavior, ui-strategy, and ui-strategy-hooks tests.
 */

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
