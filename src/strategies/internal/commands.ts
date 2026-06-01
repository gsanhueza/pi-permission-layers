/**
 * Shared command logic used by both UI and no-UI handlers.
 */

import { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { invalidateConfigCache } from "../../core/config";
import {
  loadPermissionConfig,
  savePermissionConfig,
} from "../../core/settings";

// ============================================================================
// NOTIFICATION HELPER
// ============================================================================

/**
 * Send a notification to the agent session.
 *
 * @param ctx      - Extension context (command or event).
 * @param message  - The notification message (no prefix needed).
 * @param level    - Notification level (info or warning).
 * @param prefix   - Optional prefix (e.g. "[pi-permission-layers] "). Pass empty string in UI mode.
 */
export const notify = (
  ctx: { ui: { notify: (msg: string, level: "info" | "warning") => void } },
  message: string,
  level: "info" | "warning" = "info",
  prefix = "",
): void => {
  ctx.ui.notify(`${prefix}${message}`, level);
};

export const handleConfigSubcommand = async (
  args: string,
  ctx: ExtensionCommandContext,
  prefix = "",
): Promise<void> => {
  const parts = args.trim().split(/\s+/);
  const action = parts[0];

  if (action === "show") {
    const config = loadPermissionConfig();
    const configStr = JSON.stringify(config, null, 2);
    notify(ctx, `Permission Config:\n${configStr}`, "info", prefix);
    return;
  }

  if (action === "reset") {
    savePermissionConfig({});
    invalidateConfigCache();
    notify(ctx, "Permission config reset to defaults", "info", prefix);
    return;
  }

  const help = `Usage: /permission config <action>

Actions:
  show  - Display current configuration
  reset - Reset to default configuration

Edit ~/.pi/agent/settings.json directly for full control:

{
  "permissionConfig": {
    "overrides": {
      "minimal": ["tmux list-*", "tmux show-*"],
      "medium": ["tmux attach*", "tmux new*"],
      "high": ["rm -rf *"],
      "dangerous": ["dd if=* of=/dev/*"]
    },
    "tools": {
      "minimal": ["read", "ls", "grep", "find"],
      "low": ["write", "edit"]
    },
    "mcp": {
      "minimal": ["search", "describe", "list", "status", "connect"],
      "low": ["serper_search", "serper_scrape", "github_list_commits"],
      "medium": ["github_create_issue"]
    },
    "prefixMappings": [
      { "from": "fvm flutter", "to": "flutter" },
      { "from": "nvm exec", "to": "" },
      { "from": "rbenv exec", "to": "" },
      { "from": "pyenv exec", "to": "" }
    ],
    "quietStartup": true,
    "forceUI": true,
    "systemNotifications": "unfocused"
  }
}`;

  notify(ctx, help, "info", prefix);
};
