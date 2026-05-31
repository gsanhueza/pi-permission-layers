/**
 * No-UI state management - simplified setLevel/setMode (always session-only)
 */

import type { PermissionState } from "../core/interfaces";
import type { PermissionLevel, PermissionMode } from "../core/types";

export const setLevel = (
  state: PermissionState,
  level: PermissionLevel,
): void => {
  state.currentLevel = level;
  state.isSessionOnly = true;
};

export const setMode = (state: PermissionState, mode: PermissionMode): void => {
  state.permissionMode = mode;
  state.isModeSessionOnly = true;
};
