/**
 * Strategy test helpers.
 */

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
