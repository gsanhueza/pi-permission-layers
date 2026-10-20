import { vi } from "vitest";

/**
 * Config mock — stubs invalidateConfigCache for tests that need it.
 */
export const configMock: Record<string, unknown> = {
  invalidateConfigCache: vi.fn(),
};
