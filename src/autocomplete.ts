import type { AutocompleteItem } from "@earendil-works/pi-tui";
import {
  LEVEL_INFO,
  LEVELS,
  PERMISSION_MODE_INFO,
  PERMISSION_MODES,
} from "./core/types";

export const getPermissionCompletions = (
  prefix: string,
): AutocompleteItem[] | null => {
  const parts = prefix.trim().split(/\s+/).filter(Boolean);

  // Handle /permission config <subcommand>
  if (parts[0] === "config") {
    if (parts.length > 2) return null;
    const subPrefix = parts[1] || "";
    const subItems = [
      {
        value: "show",
        label: "show",
        description: "Display current configuration",
      },
      {
        value: "reset",
        label: "reset",
        description: "Reset to default configuration",
      },
    ];
    const filtered = subItems.filter((i) => i.value.startsWith(subPrefix));
    if (filtered.length === 0) return null;
    // Include "config " in the value so applyCompletion preserves it
    return filtered.map((i) => ({
      ...i,
      value: `config ${i.value}`,
    }));
  }

  // Handle /permission <level>
  if (parts.length > 1) return null;
  const levelPrefix = parts[0] || "";
  const items = [
    ...LEVELS.map((level) => ({
      value: level,
      label: `${LEVEL_INFO[level].label} (${level})`,
      description: LEVEL_INFO[level].desc,
    })),
    {
      value: "config",
      label: "Configurations",
      description: "Show or reset configuration",
    },
    {
      value: "settings",
      label: "UI settings",
      description: "Setup quietStartup/forceUI",
    },
  ];
  const filtered = items.filter((i) => i.value.startsWith(levelPrefix));
  return filtered.length > 0 ? filtered : null;
};

export const getPermissionModeCompletions = (
  prefix: string,
): AutocompleteItem[] | null => {
  const items = PERMISSION_MODES.map((mode) => ({
    value: mode,
    label: `${PERMISSION_MODE_INFO[mode].label} (${mode})`,
    description: PERMISSION_MODE_INFO[mode].desc,
  }));
  const filtered = items.filter((i) => i.value.startsWith(prefix));
  return filtered.length > 0 ? filtered : null;
};
