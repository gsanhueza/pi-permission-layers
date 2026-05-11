/**
 * PermissionState management - create, set level, set mode
 */

import {
  saveGlobalPermission,
  saveGlobalPermissionMode,
} from "./core/settings";
import type {
  PermissionLevel,
  PermissionMode,
  PermissionState,
} from "./core/types";
import { getStatusText } from "./ui";

export function createInitialState(): PermissionState {
  return {
    currentLevel: "minimal",
    isSessionOnly: false,
    permissionMode: "ask",
    isModeSessionOnly: false,
  };
}

export function setLevel(
  state: PermissionState,
  level: PermissionLevel,
  saveGlobally: boolean,
  ctx: any,
): void {
  state.currentLevel = level;
  state.isSessionOnly = !saveGlobally;
  if (saveGlobally) {
    saveGlobalPermission(level);
  }
  if (ctx.ui?.setStatus) {
    ctx.ui.setStatus("authority", getStatusText(level));
  }
}

export function setMode(
  state: PermissionState,
  mode: PermissionMode,
  saveGlobally: boolean,
  ctx: any,
): void {
  state.permissionMode = mode;
  state.isModeSessionOnly = !saveGlobally;
  if (saveGlobally) {
    saveGlobalPermissionMode(mode);
  }
}
