/**
 * Shared event handling - session initialization
 */

import type { PermissionState } from "../../core/interfaces";
import { SettingsService } from "../../core/settings";
import type { PermissionLevel } from "../../core/types";
import { LEVELS } from "../../core/types";

// ============================================================================
// SESSION INITIALIZATION
// ============================================================================

export const initializeSessionState = (
  state: PermissionState,
  settingsService: SettingsService,
): void => {
  const envLevel = process.env.PI_PERMISSION_LEVEL?.toLowerCase();
  if (envLevel && LEVELS.includes(envLevel as PermissionLevel)) {
    state.currentLevel = envLevel as PermissionLevel;
  } else {
    const globalLevel = settingsService.loadGlobalPermissionLevel();
    if (globalLevel) {
      state.currentLevel = globalLevel;
    }
  }

  const globalMode = settingsService.loadGlobalPermissionMode();
  if (globalMode) {
    state.permissionMode = globalMode;
  }
};
