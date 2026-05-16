/**
 * PermissionState management - create, set level, set mode
 */

import { ExtensionContext } from "@earendil-works/pi-coding-agent";
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

export const createInitialState = (): PermissionState => {
  return {
    currentLevel: "minimal",
    isSessionOnly: false,
    permissionMode: "ask",
    isModeSessionOnly: false,
  };
};

export const setLevel = (
  state: PermissionState,
  level: PermissionLevel,
  saveGlobally: boolean,
  ctx: ExtensionContext,
): void => {
  state.currentLevel = level;
  state.isSessionOnly = !saveGlobally;
  if (saveGlobally) {
    saveGlobalPermission(level);
  }
  if (ctx.ui?.setStatus) {
    ctx.ui.setStatus("authority", getStatusText(level));
  }
};

export const setMode = (
  state: PermissionState,
  mode: PermissionMode,
  saveGlobally: boolean,
  ctx: ExtensionContext,
): void => {
  state.permissionMode = mode;
  state.isModeSessionOnly = !saveGlobally;
  if (saveGlobally) {
    saveGlobalPermissionMode(mode);
  }
};
