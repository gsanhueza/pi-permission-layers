/**
 * Permission settings UI — /permission settings
 */

import { getSettingsListTheme } from "@earendil-works/pi-coding-agent";
import { type SettingItem, SettingsList } from "@earendil-works/pi-tui";
import { invalidateConfigCache } from "../../core/config";
import {
  loadPermissionConfig,
  savePermissionConfig,
} from "../../core/settings";
import { Notification } from "../../core/types";

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
    {
      id: "system-notifications",
      label: "System notifications",
      description: "Control OS notification behavior",
      currentValue: config.systemNotifications ?? "unfocused",
      values: ["off", "on", "unfocused", "persistent"],
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
      if (id === "system-notifications")
        cfg.systemNotifications = newValue as Notification;
      savePermissionConfig(cfg);
      invalidateConfigCache();
    },
    done,
    { enableSearch: false },
  );
};
