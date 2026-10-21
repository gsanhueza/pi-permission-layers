/**
 * Permission settings UI — /permission settings
 */

import { getSettingsListTheme } from "@earendil-works/pi-coding-agent";
import { type SettingItem, SettingsList } from "@earendil-works/pi-tui";
import { SettingsService } from "../../core/settings";
import { Notification } from "../../core/types";

export const createSettingsList = (
  settingsService: SettingsService,
  done: () => void,
): SettingsList => {
  const config = settingsService.getPermissionConfig();

  const items: SettingItem[] = [
    {
      id: "quiet-startup",
      label: "Quiet startup",
      description: "Hide permission startup help message",
      currentValue: config.quietStartup ? "on" : "off",
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
      const cfg = settingsService.getPermissionConfig();
      if (id === "quiet-startup") cfg.quietStartup = newValue === "on";
      if (id === "system-notifications")
        cfg.systemNotifications = newValue as Notification;
      settingsService.savePermissionConfig(cfg);
    },
    done,
    { enableSearch: false },
  );
};
