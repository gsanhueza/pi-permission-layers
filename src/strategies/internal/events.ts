/**
 * Shared event handling - session initialization
 */

import type { PermissionState } from "../../core/interfaces";
import {
  loadGlobalPermissionLevel,
  loadGlobalPermissionMode,
} from "../../core/settings";
import type { PermissionLevel } from "../../core/types";
import { LEVELS } from "../../core/types";

// ============================================================================
// SESSION INITIALIZATION
// ============================================================================

export const initializeSessionState = (state: PermissionState): void => {
  const envLevel = process.env.PI_PERMISSION_LEVEL?.toLowerCase();
  if (envLevel && LEVELS.includes(envLevel as PermissionLevel)) {
    state.currentLevel = envLevel as PermissionLevel;
  } else {
    const globalLevel = loadGlobalPermissionLevel();
    if (globalLevel) {
      state.currentLevel = globalLevel;
    }
  }

  const globalMode = loadGlobalPermissionMode();
  if (globalMode) {
    state.permissionMode = globalMode;
  }
};
