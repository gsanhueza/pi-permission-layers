import { getSettingsMock } from "./factories";

/**
 * Default settings mock — used when tests don't need custom overrides.
 */
export const settingsMock: Record<string, unknown> = getSettingsMock();

/**
 * Settings mock for strategy tests — stubs global level/mode persistence.
 */
export const strategySettingsMock: Record<string, unknown> = {
  ...settingsMock,
  loadGlobalPermissionLevel: () => null,
  loadGlobalPermissionMode: () => null,
  saveGlobalPermissionLevel: () => {},
  saveGlobalPermissionMode: () => {},
};

/**
 * Settings mock for config tests — stubs savePermissionConfig for assertions.
 */
export function configSettingsMock(
  savePermissionConfig: (config: Record<string, unknown>) => void,
): Record<string, unknown> {
  return {
    ...settingsMock,
    savePermissionConfig,
  };
}
