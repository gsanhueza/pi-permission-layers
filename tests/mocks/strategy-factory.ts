import { vi } from "vitest";

import type { PermissionConfig } from "../../src/core/interfaces";
import { SettingsService } from "../../src/core/settings";
import { NoUIPermissionStrategy } from "../../src/strategies/no-ui-strategy";
import { UIPermissionStrategy } from "../../src/strategies/ui-strategy";

/** Options for creating a UI-enabled test strategy. */
export interface UIStrategyDeps {
  getCachedConfig?: () => PermissionConfig;
  settingsService?: SettingsService;
  execFileFn?: ReturnType<typeof vi.fn>;
  saveLevel?: ReturnType<typeof vi.fn>;
  saveMode?: ReturnType<typeof vi.fn>;
}

/** Options for creating a no-UI test strategy. */
export interface NoUIStrategyDeps {
  saveLevel?: ReturnType<typeof vi.fn>;
  saveMode?: ReturnType<typeof vi.fn>;
}

/**
 * Create a UIPermissionStrategy for tests.
 *
 * @example
 * ```ts
 * const strategy = createUIPermissionStrategy();
 * const strategy = createUIPermissionStrategy({ getCachedConfig: () => customConfig });
 * ```
 */
export function createUIPermissionStrategy(
  deps?: UIStrategyDeps,
): UIPermissionStrategy {
  const settingsService: SettingsService = {
    loadPermissionConfig: () => ({}),
    loadGlobalPermissionLevel: () => null,
    loadGlobalPermissionMode: () => null,
    saveGlobalPermissionLevel: deps?.saveLevel ?? (() => {}),
    saveGlobalPermissionMode: deps?.saveMode ?? (() => {}),
  } as unknown as SettingsService;

  return new UIPermissionStrategy(
    deps?.getCachedConfig ?? (() => ({})),
    deps?.settingsService ?? settingsService,
    deps?.execFileFn as any,
  );
}

/**
 * Create a NoUIPermissionStrategy for tests.
 *
 * @example
 * ```ts
 * const strategy = createNoUIPermissionStrategy();
 * const strategy = createNoUIPermissionStrategy({ saveLevel: myMock });
 * ```
 */
export function createNoUIPermissionStrategy(
  deps?: NoUIStrategyDeps,
): NoUIPermissionStrategy {
  return new NoUIPermissionStrategy(
    () => ({}),
    {
      loadPermissionConfig: () => ({}),
      loadGlobalPermissionLevel: () => null,
      loadGlobalPermissionMode: () => null,
      saveGlobalPermissionLevel: deps?.saveLevel ?? (() => {}),
      saveGlobalPermissionMode: deps?.saveMode ?? (() => {}),
    } as unknown as SettingsService,
    undefined,
  );
}
