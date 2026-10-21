/**
 * Shared permission check — used by both UI and no-UI handlers.
 *
 * Returns true if the current state allows the required level,
 * false if permission is insufficient.
 */

import type { PermissionState } from "../../core/interfaces";
import type { PermissionLevel } from "../../core/types";
import { LEVEL_INDEX } from "../../core/types";

/**
 * Check whether the current permission state allows the required level.
 *
 * @param state - The current permission state.
 * @param requiredLevel - The level required by the operation.
 * @returns True if allowed, false if insufficient.
 */
export const checkPermission = (
  state: PermissionState,
  requiredLevel: PermissionLevel,
): boolean => {
  if (state.currentLevel === "bypassed") return true;
  return LEVEL_INDEX[state.currentLevel] >= LEVEL_INDEX[requiredLevel];
};
