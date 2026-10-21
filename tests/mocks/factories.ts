/**
 * Mock factory helpers for vi.mock callbacks.
 */

const mockSettings = {
  permissionLevel: "minimal",
  permissionConfig: {
    quietStartup: false,
    systemNotifications: "off",
  },
};

/**
 * Build a vi.mock callback for the settings module.
 *
 * @param extra - Optional additional mock functions (e.g. savePermissionConfig).
 */
export function getSettingsMock(extra?: {
  loadGlobalPermissionLevel?: () => string | null;
  loadGlobalPermissionMode?: () => string | null;
  saveGlobalPermissionLevel?: (level: string, ctx: unknown) => void;
  saveGlobalPermissionMode?: (mode: string, ctx: unknown) => void;
  savePermissionConfig?: (config: Record<string, unknown>) => void;
}): Record<string, unknown> {
  return {
    loadPermissionConfig: () =>
      (mockSettings.permissionConfig as Record<string, unknown>) ?? {},
    ...extra,
  };
}

/**
 * Build a vi.mock callback for @earendil-works/pi-coding-agent.
 * All exports from that package are type-only, so empty objects suffice.
 */
export function getPiCodingAgentMock(): Record<string, unknown> {
  return {
    ExtensionContext: {},
    ExtensionCommandContext: {},
    ToolCallEvent: {},
    getAgentDir: () => "/tmp/pi-agent",
  };
}
