import { SettingsService } from "../../src/core/settings";
import { NoUIPermissionStrategy } from "../../src/strategies/no-ui-strategy";
import { UIPermissionStrategy } from "../../src/strategies/ui-strategy";

/** Options for creating a UI-enabled test strategy. */
export interface UIStrategyDeps {
  saveLevel?: () => void;
  saveMode?: () => void;
}

/**
 * Create a UIPermissionStrategy for tests.
 *
 * @example
 * ```ts
 * const strategy = createUIPermissionStrategy();
 * ```
 */
export function createUIPermissionStrategy(
  deps?: UIStrategyDeps,
): UIPermissionStrategy {
  const settingsService: SettingsService = {
    getPermissionConfig: () => ({}),
    savePermissionConfig: () => {},
    clearCache: () => {},
    loadGlobalPermissionLevel: () => null,
    loadGlobalPermissionMode: () => null,
    saveGlobalPermissionLevel: deps?.saveLevel ?? (() => {}),
    saveGlobalPermissionMode: deps?.saveMode ?? (() => {}),
  } as unknown as SettingsService;

  return new UIPermissionStrategy(settingsService, (() => {}) as any);
}

/**
 * Create a NoUIPermissionStrategy for tests.
 */
export function createNoUIPermissionStrategy(): NoUIPermissionStrategy {
  return new NoUIPermissionStrategy(
    {
      getPermissionConfig: () => ({}),
      savePermissionConfig: () => {},
      clearCache: () => {},
      loadGlobalPermissionLevel: () => null,
      loadGlobalPermissionMode: () => null,
      saveGlobalPermissionLevel: () => {},
      saveGlobalPermissionMode: () => {},
    } as unknown as SettingsService,
    (() => {}) as any,
  );
}
