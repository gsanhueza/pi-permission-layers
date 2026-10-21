/**
 * Tests for BasePermissionStrategy — NoUI defaults and shared algorithm.
 *
 * Run with: npm test
 */

import { describe, expect, test, vi } from "vitest";
import { BasePermissionStrategy } from "../../src/strategies/base-strategy";
import type { SettingsService } from "../../src/core/settings";
import type {
  ExtensionCommandContext,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";

// ============================================================================
// MOCKS
// ============================================================================

function createMockCtx(): ExtensionContext {
  return {
    ui: {
      select: async () => "Allow once",
      notify: () => {},
      setStatus: () => {},
    },
    hasUI: false,
    cwd: ".",
  } as unknown as ExtensionContext;
}

function createMockCommandCtx(): ExtensionCommandContext {
  return {
    ui: {
      select: async () => "Session only",
      notify: () => {},
      setStatus: () => {},
    },
    hasUI: false,
    cwd: ".",
    argv: [],
  } as unknown as ExtensionCommandContext;
}

// We need a concrete strategy to test the base class since it has no abstract methods.
// Create a minimal subclass that just exposes the protected hooks.
class TestableBaseStrategy extends BasePermissionStrategy {
  constructor(settingsService?: SettingsService) {
    super(settingsService);
  }

  // Expose protected hooks for testing
  public async testOnDangerous(
    command: string,
    ctx: ExtensionContext,
  ): Promise<{ block: true; reason: string } | undefined> {
    return (this as any).onDangerous(command, ctx);
  }

  public async testOnRequest(
    requiredLevel: string,
    message: string,
    details: string,
    ctx: ExtensionContext,
  ): Promise<{ block: true; reason: string } | undefined> {
    return (this as any).onRequest(
      requiredLevel as never,
      message,
      details,
      ctx,
    );
  }

  public async testOnViewLevel(ctx: ExtensionCommandContext): Promise<void> {
    return (this as any).onViewLevel(ctx);
  }

  public async testOnSetLevel(
    level: string,
    ctx: ExtensionCommandContext,
  ): Promise<void> {
    return (this as any).onSetLevel(level as never, ctx);
  }

  public async testOnViewMode(ctx: ExtensionCommandContext): Promise<void> {
    return (this as any).onViewMode(ctx);
  }

  public async testOnSetMode(
    mode: string,
    ctx: ExtensionCommandContext,
  ): Promise<void> {
    return (this as any).onSetMode(mode as never, ctx);
  }

  public async testCheckAndHandleTool(
    classification: any,
    toolName: string,
    message: string,
    details: string,
    ctx: ExtensionContext,
  ): Promise<{ block: true; reason: string } | undefined> {
    return (this as any).checkAndHandleTool(
      classification,
      toolName,
      message,
      details,
      ctx,
    );
  }
}

// ============================================================================
// onDangerous — NoUI default
// ============================================================================

describe("BasePermissionStrategy: onDangerous", () => {
  test("returns a block result with bypass hint", async () => {
    const strategy = new TestableBaseStrategy();
    const result = await strategy.testOnDangerous("rm -rf /", createMockCtx());

    expect(result).toEqual({
      block: true,
      reason: expect.stringContaining(
        "Dangerous command requires confirmation",
      ),
    });
    expect(result?.reason).toContain("PI_PERMISSION_LEVEL=bypassed");
  });
});

// ============================================================================
// onRequest — NoUI default
// ============================================================================

describe("BasePermissionStrategy: onRequest", () => {
  test("returns undefined when current level is sufficient", async () => {
    const strategy = new TestableBaseStrategy();
    // bypassed level allows everything
    (strategy as any).state.currentLevel = "bypassed";

    const result = await strategy.testOnRequest(
      "high",
      "test message",
      "test details",
      createMockCtx(),
    );

    expect(result).toBeUndefined();
  });

  test("returns block when permission is insufficient", async () => {
    const strategy = new TestableBaseStrategy();
    (strategy as any).state.currentLevel = "minimal";

    const result = await strategy.testOnRequest(
      "low",
      "test message",
      "test details",
      createMockCtx(),
    );

    expect(result).toEqual({
      block: true,
      reason: expect.stringContaining("Blocked by permission"),
    });
    expect(result?.reason).toContain("minimal");
    expect(result?.reason).toContain("PI_PERMISSION_LEVEL=low");
  });
});

// ============================================================================
// onViewLevel / onSetLevel — NoUI default
// ============================================================================

describe("BasePermissionStrategy: level commands", () => {
  test("onViewLevel notifies with current level", async () => {
    const notify = vi.fn();
    const strategy = new TestableBaseStrategy();
    const ctx = {
      ...createMockCommandCtx(),
      ui: {
        ...createMockCommandCtx().ui,
        notify,
      },
    } as unknown as ExtensionCommandContext;

    await strategy.testOnViewLevel(ctx);

    expect(notify).toHaveBeenCalledWith(
      "[pi-permission-layers] Current permission: Medium (Dev operations)",
      "info",
    );
  });

  test("onSetLevel sets level and notifies", async () => {
    const notify = vi.fn();
    const strategy = new TestableBaseStrategy();
    const ctx = {
      ...createMockCommandCtx(),
      ui: {
        ...createMockCommandCtx().ui,
        notify,
      },
    } as unknown as ExtensionCommandContext;

    await strategy.testOnSetLevel("low", ctx);

    expect((strategy as any).state.currentLevel).toBe("low");
    expect((strategy as any).state.isSessionOnly).toBe(true);
    expect(notify).toHaveBeenCalledWith(
      "[pi-permission-layers] Permission: Low",
      "info",
    );
  });
});

// ============================================================================
// onViewMode / onSetMode — NoUI default
// ============================================================================

describe("BasePermissionStrategy: mode commands", () => {
  test("onViewMode notifies with current mode", async () => {
    const notify = vi.fn();
    const strategy = new TestableBaseStrategy();
    const ctx = {
      ...createMockCommandCtx(),
      ui: {
        ...createMockCommandCtx().ui,
        notify,
      },
    } as unknown as ExtensionCommandContext;

    await strategy.testOnViewMode(ctx);

    expect(notify).toHaveBeenCalledWith(
      expect.stringContaining("[pi-permission-layers] Current permission mode"),
      "info",
    );
  });

  test("onSetMode sets mode and notifies", async () => {
    const notify = vi.fn();
    const strategy = new TestableBaseStrategy();
    const ctx = {
      ...createMockCommandCtx(),
      ui: {
        ...createMockCommandCtx().ui,
        notify,
      },
    } as unknown as ExtensionCommandContext;

    await strategy.testOnSetMode("block", ctx);

    expect((strategy as any).state.permissionMode).toBe("block");
    expect((strategy as any).state.isModeSessionOnly).toBe(true);
    expect(notify).toHaveBeenCalledWith(
      "[pi-permission-layers] Permission mode: Block",
      "info",
    );
  });
});

// ============================================================================
// configPrefix
// ============================================================================

describe("BasePermissionStrategy: configPrefix", () => {
  test("returns NoUI prefix by default", () => {
    const strategy = new TestableBaseStrategy();
    expect((strategy as any).configPrefix()).toBe("[pi-permission-layers] ");
  });
});

// ============================================================================
// checkAndHandleTool — decision tree
// ============================================================================

describe("BasePermissionStrategy: checkAndHandleTool", () => {
  test("calls onDangerous when classification is dangerous", async () => {
    const strategy = new TestableBaseStrategy();
    const classification = { level: "medium" as const, dangerous: true };

    const result = await strategy.testCheckAndHandleTool(
      classification,
      "rm -rf /",
      "rm -rf /",
      "Dangerous command",
      createMockCtx(),
    );

    expect(result).toEqual({
      block: true,
      reason: expect.stringContaining(
        "Dangerous command requires confirmation",
      ),
    });
  });

  test("calls onRequest(high) when classification blocks but not dangerous", async () => {
    const strategy = new TestableBaseStrategy();
    // bypassed state so onRequest returns undefined for high
    (strategy as any).state.currentLevel = "bypassed";

    const classification = { level: "medium" as const, dangerous: false };
    const result = await strategy.testCheckAndHandleTool(
      classification,
      "unknown-tool",
      "unknown-tool",
      "Tool: unknown-tool",
      createMockCtx(),
    );

    // Should call onRequest with "high" level
    expect(result).toBeUndefined();
  });

  test("calls onRequest with classification level when not blocked", async () => {
    const strategy = new TestableBaseStrategy();
    // bypassed so onRequest returns undefined
    (strategy as any).state.currentLevel = "bypassed";

    const classification = { level: "low" as const, dangerous: false };
    const result = await strategy.testCheckAndHandleTool(
      classification,
      "ls",
      "ls",
      "List files",
      createMockCtx(),
    );

    expect(result).toBeUndefined();
  });

  test("handles null classification as blocked with high", async () => {
    const strategy = new TestableBaseStrategy();
    (strategy as any).state.currentLevel = "bypassed";

    const result = await strategy.testCheckAndHandleTool(
      null,
      "unknown",
      "unknown",
      "Unknown tool",
      createMockCtx(),
    );

    expect(result).toBeUndefined();
  });
});

// ============================================================================
// handlePermissionCommand — routing
// ============================================================================

describe("BasePermissionStrategy: handlePermissionCommand", () => {
  test("unknown level shows current level", async () => {
    const notify = vi.fn();
    const strategy = new TestableBaseStrategy();
    const ctx = {
      ...createMockCommandCtx(),
      ui: {
        ...createMockCommandCtx().ui,
        notify,
      },
    } as unknown as ExtensionCommandContext;

    await strategy.handlePermissionCommand("invalid", ctx);

    expect(notify).toHaveBeenCalledWith(
      expect.stringContaining("Current permission"),
      "info",
    );
  });

  test("empty args shows current level", async () => {
    const notify = vi.fn();
    const strategy = new TestableBaseStrategy();
    const ctx = {
      ...createMockCommandCtx(),
      ui: {
        ...createMockCommandCtx().ui,
        notify,
      },
    } as unknown as ExtensionCommandContext;

    await strategy.handlePermissionCommand("", ctx);

    expect(notify).toHaveBeenCalledWith(
      expect.stringContaining("Current permission"),
      "info",
    );
  });

  test("sets level when valid level passed", async () => {
    const notify = vi.fn();
    const strategy = new TestableBaseStrategy();
    const ctx = {
      ...createMockCommandCtx(),
      ui: {
        ...createMockCommandCtx().ui,
        notify,
      },
    } as unknown as ExtensionCommandContext;

    await strategy.handlePermissionCommand("high", ctx);

    expect((strategy as any).state.currentLevel).toBe("high");
    expect((strategy as any).state.isSessionOnly).toBe(true);
    expect(notify).toHaveBeenCalledWith(
      "[pi-permission-layers] Permission: High",
      "info",
    );
  });

  test("config subcommand delegates to handleConfigSubcommand", async () => {
    const notify = vi.fn();
    const strategy = new TestableBaseStrategy();
    const ctx = {
      ...createMockCommandCtx(),
      ui: {
        ...createMockCommandCtx().ui,
        notify,
      },
    } as unknown as ExtensionCommandContext;

    await strategy.handlePermissionCommand("config show", ctx);

    expect(notify).toHaveBeenCalledWith(
      expect.stringContaining("Permission Config"),
      "info",
    );
  });
});

// ============================================================================
// handlePermissionModeCommand — routing
// ============================================================================

describe("BasePermissionStrategy: handlePermissionModeCommand", () => {
  test("empty args shows current mode", async () => {
    const notify = vi.fn();
    const strategy = new TestableBaseStrategy();
    const ctx = {
      ...createMockCommandCtx(),
      ui: {
        ...createMockCommandCtx().ui,
        notify,
      },
    } as unknown as ExtensionCommandContext;

    await strategy.handlePermissionModeCommand("", ctx);

    expect(notify).toHaveBeenCalledWith(
      expect.stringContaining("Current permission mode"),
      "info",
    );
  });

  test("sets mode when valid mode passed", async () => {
    const notify = vi.fn();
    const strategy = new TestableBaseStrategy();
    const ctx = {
      ...createMockCommandCtx(),
      ui: {
        ...createMockCommandCtx().ui,
        notify,
      },
    } as unknown as ExtensionCommandContext;

    await strategy.handlePermissionModeCommand("ask", ctx);

    expect((strategy as any).state.permissionMode).toBe("ask");
    expect((strategy as any).state.isModeSessionOnly).toBe(true);
    expect(notify).toHaveBeenCalledWith(
      "[pi-permission-layers] Permission mode: Ask",
      "info",
    );
  });
});
