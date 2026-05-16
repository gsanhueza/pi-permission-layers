/**
 * Permission settings UI — /permission settings
 */

import { getSettingsListTheme } from "@earendil-works/pi-coding-agent";
import { type SettingItem, SettingsList } from "@earendil-works/pi-tui";
import { loadPermissionConfig, savePermissionConfig } from "../core/settings";
import { invalidateConfigCache } from "../core/tools";

export const createSettingsList = (done: () => void): SettingsList => {
  const config = loadPermissionConfig();

  const items: SettingItem[] = [
    {
      id: "quiet-startup",
      label: "Quiet startup",
      description: "Hide permission startup help message",
      currentValue: config.quietStartup ? "on" : "off",
      values: ["on", "off"],
    },
    {
      id: "force-ui",
      label: "Force UI",
      description: "Always use interactive UI even in non-interactive mode",
      currentValue: config.forceUI ? "on" : "off",
      values: ["on", "off"],
    },
  ];

  return new SettingsList(
    items,
    items.length,
    getSettingsListTheme(),
    (id, newValue) => {
      const cfg = loadPermissionConfig();
      if (id === "quiet-startup") cfg.quietStartup = newValue === "on";
      if (id === "force-ui") cfg.forceUI = newValue === "on";
      savePermissionConfig(cfg);
      invalidateConfigCache();
    },
    done,
    { enableSearch: false },
  );
};
