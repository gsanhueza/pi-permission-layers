/**
 * Shared command logic used by both UI and no-UI handlers.
 */

import { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { invalidateConfigCache } from "../core/config";
import { loadPermissionConfig, savePermissionConfig } from "../core/settings";

export const handleConfigSubcommand = async (
  args: string,
  ctx: ExtensionCommandContext,
): Promise<void> => {
  const parts = args.trim().split(/\s+/);
  const action = parts[0];

  if (action === "show") {
    const config = loadPermissionConfig();
    const configStr = JSON.stringify(config, null, 2);
    ctx.ui.notify(`Permission Config:\n${configStr}`, "info");
    return;
  }

  if (action === "reset") {
    savePermissionConfig({});
    invalidateConfigCache();
    ctx.ui.notify("Permission config reset to defaults", "info");
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
      "medium": ["tmux *", "screen *"],
      "high": ["rm -rf *"],
      "dangerous": ["dd if=* of=/dev/*"]
    },
    "prefixMappings": [
      { "from": "fvm flutter", "to": "flutter" },
      { "from": "nvm exec", "to": "" }
    ],
    "quietStartup": true,
    "forceUI": true,
    "systemNotifications": "unfocused"
  }
}`;

  ctx.ui.notify(help, "info");
};
