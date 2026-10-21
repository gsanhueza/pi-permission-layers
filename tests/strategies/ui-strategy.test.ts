/**
 * Tests for permission prompt UI behavior
 *
 * Covers UIPermissionStrategy and NoUIPermissionStrategy tool call
 * handlers, and the request permission flow (tested indirectly).
 *
 * Run with: npm test
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import { getPiCodingAgentMock } from "../mocks/factories";
import { makeCtx, CANCEL } from "../mocks/context";
import type { NotifyCall, SelectCall } from "../mocks/context";
import { resetStrategyState } from "../mocks/strategies";

vi.mock("@earendil-works/pi-coding-agent", () => getPiCodingAgentMock());

import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import {
  createNoUIPermissionStrategy,
  createUIPermissionStrategy,
} from "../mocks/strategy-factory";

// Extended context type for hook tests
interface TestCommandContext extends ExtensionCommandContext {
  selectCalls: SelectCall[];
  notifyCalls: NotifyCall[];
}

// ============================================================================
// Strategy instances (shared across tests)
// ============================================================================

const uiStrategy = createUIPermissionStrategy();
const noUIStrategy = createNoUIPermissionStrategy();

beforeEach(() => {
  resetStrategyState(uiStrategy);
});

// ============================================================================
// handleBashToolCall - command displayed in prompt
// ============================================================================

describe("bash prompt: command shown with $ prefix in message", () => {
  test("command shown with $ prefix", async () => {
    const ctx = makeCtx("Cancel");

    await uiStrategy.handleBashToolCall(
      "git push origin main",
      ctx as unknown as never,
    );

    expect(ctx.selectCalls.length).toBeGreaterThan(0);
    const { message } = ctx.selectCalls[0];
    expect(message).toMatch(/^\[Requires \w+\]: \$ git push origin main/);
  });
});

describe("bash prompt: full command shown in message", () => {
  test("full command shown", async () => {
    const ctx = makeCtx("Cancel");

    await uiStrategy.handleBashToolCall("npm install", ctx as unknown as never);

    expect(ctx.selectCalls.length).toBeGreaterThan(0);
    const { message } = ctx.selectCalls[0];
    expect(message).toContain("npm install");
  });
});

describe("bash prompt: long command shown in full", () => {
  test("long command not truncated", async () => {
    const ctx = makeCtx("Cancel");

    const longCmd = "git commit -m '" + "x".repeat(80) + "'";
    await uiStrategy.handleBashToolCall(longCmd, ctx as unknown as never);

    expect(ctx.selectCalls.length).toBeGreaterThan(0);
    const { message } = ctx.selectCalls[0];
    expect(message).toContain(longCmd);
    expect(message).not.toContain("…");
  });
});

describe("bash prompt: required level shown in message", () => {
  test("high level shown", async () => {
    const ctx = makeCtx("Cancel");

    await uiStrategy.handleBashToolCall(
      "git push origin main",
      ctx as unknown as never,
    );

    expect(ctx.selectCalls.length).toBeGreaterThan(0);
    const { message } = ctx.selectCalls[0];
    expect(message).toContain("[Requires High]");
  });

  test("medium level shown", async () => {
    const ctx = makeCtx("Cancel");

    await uiStrategy.handleBashToolCall("npm install", ctx as unknown as never);

    expect(ctx.selectCalls.length).toBeGreaterThan(0);
    const { message } = ctx.selectCalls[0];
    expect(message).toContain("[Requires Medium]");
  });
});

// ============================================================================
// handleBashToolCall - options
// ============================================================================

describe("bash prompt: options include Allow once, Allow all, Cancel", () => {
  test("options include correct choices", async () => {
    const ctx = makeCtx("Cancel");

    await uiStrategy.handleBashToolCall("git push", ctx as unknown as never);

    expect(ctx.selectCalls.length).toBeGreaterThan(0);
    const { options } = ctx.selectCalls[0];
    expect(options).toContain("Allow once");
    expect(options).toContain("Cancel");
    expect(options.some((o) => o.startsWith("Allow all"))).toBe(true);
  });
});

describe("bash prompt: Allow all option includes level and (session)", () => {
  test("high level Allow all", async () => {
    const ctx = makeCtx("Cancel");

    await uiStrategy.handleBashToolCall("git push", ctx as unknown as never);

    const { options } = ctx.selectCalls[0];
    const allowAll = options.find((o) => o.startsWith("Allow all"));
    expect(allowAll).toBe("Allow all High (session)");
  });

  test("medium level Allow all", async () => {
    const ctx = makeCtx("Cancel");

    await uiStrategy.handleBashToolCall("npm install", ctx as unknown as never);

    const { options } = ctx.selectCalls[0];
    const allowAll = options.find((o) => o.startsWith("Allow all"));
    expect(allowAll).toBe("Allow all Medium (session)");
  });
});

// ============================================================================
// handleBashToolCall - allow/block behavior
// ============================================================================

describe("bash: Allow once returns undefined (allows command)", () => {
  test("Allow once", async () => {
    const ctx = makeCtx("Allow once");

    const result = await uiStrategy.handleBashToolCall(
      "git push",
      ctx as unknown as never,
    );
    expect(result).toBeUndefined();
  });
});

describe("bash: Cancel returns block result", () => {
  test("Cancel", async () => {
    const ctx = makeCtx("Cancel");

    const result = await uiStrategy.handleBashToolCall(
      "git push",
      ctx as unknown as never,
    );
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
    expect(result!.reason).toContain("Cancelled");
  });
});

describe("bash: Allow all upgrades state level for session", () => {
  test("Allow all High", async () => {
    const ctx = makeCtx("Allow all High (session)");

    const result = await uiStrategy.handleBashToolCall(
      "git push",
      ctx as unknown as never,
    );
    expect(result).toBeUndefined();
    expect(uiStrategy.state.currentLevel).toBe("high");
    expect(uiStrategy.state.isSessionOnly).toBe(true);
  });

  test("Allow all Medium", async () => {
    const ctx = makeCtx("Allow all Medium (session)");

    const result = await uiStrategy.handleBashToolCall(
      "npm install",
      ctx as unknown as never,
    );
    expect(result).toBeUndefined();
    expect(uiStrategy.state.currentLevel).toBe("medium");
  });
});

describe("bash: sufficient permission - no prompt shown", () => {
  test("no prompt when permission sufficient", async () => {
    uiStrategy.state.currentLevel = "high";
    const ctx = makeCtx("Cancel");

    const result = await uiStrategy.handleBashToolCall(
      "git push",
      ctx as unknown as never,
    );
    expect(result).toBeUndefined();
    expect(ctx.selectCalls.length).toBe(0);
  });
});

describe("bash: minimal commands always pass through without prompt", () => {
  test("minimal commands pass", async () => {
    const ctx = makeCtx("Cancel");

    const result = await uiStrategy.handleBashToolCall(
      "ls -la",
      ctx as unknown as never,
    );
    expect(result).toBeUndefined();
    expect(ctx.selectCalls.length).toBe(0);
  });
});

describe("bash: bypassed level skips all checks", () => {
  test("bypassed level", async () => {
    uiStrategy.state.currentLevel = "bypassed";
    const ctx = makeCtx("Cancel");

    const result = await uiStrategy.handleBashToolCall(
      "sudo rm -rf /",
      ctx as unknown as never,
    );
    expect(result).toBeUndefined();
    expect(ctx.selectCalls.length).toBe(0);
  });
});

// ============================================================================
// Dangerous command prompt
// ============================================================================

describe("dangerous: select title shows command with $ prefix", () => {
  test("dangerous command title", async () => {
    const ctx = makeCtx("Cancel");

    await uiStrategy.handleBashToolCall(
      "rm -rf /tmp/test",
      ctx as unknown as never,
    );

    expect(ctx.selectCalls.length).toBeGreaterThan(0);
    const { message } = ctx.selectCalls[0];
    expect(message).toMatch(/^⚠️ Dangerous: \$ /);
    expect(message).toContain("rm -rf /tmp/test");
  });
});

describe("dangerous: options are Allow once and Cancel only", () => {
  test("dangerous options", async () => {
    const ctx = makeCtx("Cancel");

    await uiStrategy.handleBashToolCall(
      "sudo apt-get install pkg",
      ctx as unknown as never,
    );

    expect(ctx.selectCalls.length).toBeGreaterThan(0);
    const { options } = ctx.selectCalls[0];
    expect(options.length).toBe(2);
    expect(options).toContain("Allow once");
    expect(options).toContain("Cancel");
    expect(options.some((o) => o.startsWith("Allow all"))).toBe(false);
  });
});

describe("dangerous: Allow once permits command", () => {
  test("dangerous Allow once", async () => {
    const ctx = makeCtx("Allow once");

    const result = await uiStrategy.handleBashToolCall(
      "rm -rf /tmp/test",
      ctx as unknown as never,
    );
    expect(result).toBeUndefined();
  });
});

describe("dangerous: Cancel blocks command", () => {
  test("dangerous Cancel", async () => {
    const ctx = makeCtx("Cancel");

    const result = await uiStrategy.handleBashToolCall(
      "rm -rf /tmp/test",
      ctx as unknown as never,
    );
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
  });
});

describe("dangerous: long dangerous command shown in full", () => {
  test("long dangerous command not truncated", async () => {
    const ctx = makeCtx("Cancel");

    const longDangerousCmd = "sudo rm -rf /tmp/" + "a".repeat(100);
    await uiStrategy.handleBashToolCall(
      longDangerousCmd,
      ctx as unknown as never,
    );

    const { message } = ctx.selectCalls[0];
    expect(message).toContain(longDangerousCmd);
    expect(message).not.toContain("…");
  });
});

// ============================================================================
// handleWriteToolCall
// ============================================================================

describe("write: prompts at minimal level", () => {
  test("write minimal", async () => {
    const ctx = makeCtx("Cancel");

    const result = await uiStrategy.handleWriteToolCall(
      "write",
      "/tmp/file.txt",
      ctx as unknown as never,
    );

    expect(result).toBeDefined();
    expect(ctx.selectCalls.length).toBeGreaterThan(0);
  });
});

describe("write: no prompt at low or above", () => {
  test("write low", async () => {
    uiStrategy.state.currentLevel = "low";
    const ctx = makeCtx("Cancel");

    const result = await uiStrategy.handleWriteToolCall(
      "write",
      "/tmp/file.txt",
      ctx as unknown as never,
    );

    expect(result).toBeUndefined();
    expect(ctx.selectCalls.length).toBe(0);
  });
});

describe("write: prompt title includes file path", () => {
  test("write file path in message", async () => {
    const ctx = makeCtx("Cancel");

    await uiStrategy.handleWriteToolCall(
      "write",
      "/src/index.ts",
      ctx as unknown as never,
    );

    expect(ctx.selectCalls.length).toBeGreaterThan(0);
    const { message } = ctx.selectCalls[0];
    expect(message).toContain("/src/index.ts");
  });
});

describe("write: Allow all upgrades state to low", () => {
  test("write Allow all", async () => {
    const ctx = makeCtx("Allow all Low (session)");

    const result = await uiStrategy.handleWriteToolCall(
      "write",
      "/tmp/file.txt",
      ctx as unknown as never,
    );

    expect(result).toBeUndefined();
    expect(uiStrategy.state.currentLevel).toBe("low");
  });
});

// ============================================================================
// handleMcpToolCall
// ============================================================================

describe("mcp: prompts at minimal level with tool name", () => {
  test("mcp minimal", async () => {
    const ctx = makeCtx("Cancel");

    await uiStrategy.handleMcpToolCall(
      { tool: "filesystem_read" },
      ctx as unknown as never,
    );

    expect(ctx.selectCalls.length).toBeGreaterThan(0);
    const { message } = ctx.selectCalls[0];
    expect(message).toContain("filesystem_read");
  });
});

describe("mcp: no prompt at medium or above", () => {
  test("mcp medium", async () => {
    uiStrategy.state.currentLevel = "medium";
    const ctx = makeCtx("Cancel");

    await uiStrategy.handleMcpToolCall(
      { tool: "some_tool" },
      ctx as unknown as never,
    );

    expect(ctx.selectCalls.length).toBe(0);
    expect(ctx.notifyCalls.some((n) => n.message.includes("some_tool"))).toBe(
      true,
    );
  });
});

describe("mcp: unknown args still show a prompt", () => {
  test("mcp unknown args", async () => {
    const ctx = makeCtx("Cancel");

    await uiStrategy.handleMcpToolCall(
      { action: "unknown_action" },
      ctx as unknown as never,
    );

    expect(ctx.selectCalls.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Block mode
// ============================================================================

describe("block mode: blocks without prompting", () => {
  test("block mode", async () => {
    uiStrategy.state.permissionMode = "block";
    const ctx = makeCtx("Allow once");

    const result = await uiStrategy.handleBashToolCall(
      "git push",
      ctx as unknown as never,
    );

    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
    expect(ctx.selectCalls.length).toBe(0);
    expect(result!.reason).toContain("block");
  });

  test("block mode dangerous", async () => {
    uiStrategy.state.permissionMode = "block";
    const ctx = makeCtx("Allow once");

    const result = await uiStrategy.handleBashToolCall(
      "rm -rf /tmp",
      ctx as unknown as never,
    );

    expect(result).toBeDefined();
    expect(ctx.selectCalls.length).toBe(0);
  });
});

// ============================================================================
// Non-interactive mode (no UI)
// ============================================================================

describe("no UI: blocks without prompting", () => {
  test("no UI", async () => {
    const ctx = makeCtx("Cancel");

    const result = await noUIStrategy.handleBashToolCall(
      "git push",
      ctx as unknown as never,
    );

    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
  });
});

// ============================================================================
// Tool permission prompts at different levels
// ============================================================================

describe("tool: write/edit prompts at minimal level", () => {
  test("write prompts at minimal", async () => {
    const ctx = makeCtx("Cancel");

    const result = await uiStrategy.handleWriteToolCall(
      "write",
      "/tmp/file.txt",
      ctx as unknown as never,
    );

    expect(result).toBeDefined();
    expect(ctx.selectCalls.length).toBeGreaterThan(0);
  });

  test("edit prompts at minimal", async () => {
    const ctx = makeCtx("Cancel");

    const result = await uiStrategy.handleWriteToolCall(
      "edit",
      "/src/index.ts",
      ctx as unknown as never,
    );

    expect(result).toBeDefined();
    expect(ctx.selectCalls.length).toBeGreaterThan(0);
  });

  test("write no prompt at low", async () => {
    uiStrategy.state.currentLevel = "low";
    const ctx = makeCtx("Cancel");

    const result = await uiStrategy.handleWriteToolCall(
      "write",
      "/tmp/file.txt",
      ctx as unknown as never,
    );

    expect(result).toBeUndefined();
    expect(ctx.selectCalls.length).toBe(0);
  });
});

// ============================================================================
// MCP permission prompts with dangerous flag
// ============================================================================

// Note: Dangerous MCP tool behavior is tested in tool-mcp-permission.test.ts
// The handler correctly routes dangerous MCP calls to onDangerous,
// which always prompts regardless of current level.

// ============================================================================
// Block mode behavior for tools and MCP
// ============================================================================

describe("block mode: tool calls blocked", () => {
  test("write blocked in block mode", async () => {
    uiStrategy.state.permissionMode = "block";
    const ctx = makeCtx("Allow once");

    const result = await uiStrategy.handleWriteToolCall(
      "write",
      "/tmp/file.txt",
      ctx as unknown as never,
    );

    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
    expect(ctx.selectCalls.length).toBe(0);
    expect(result!.reason).toContain("block");
  });
});

describe("block mode: MCP calls blocked", () => {
  test("mcp blocked in block mode", async () => {
    uiStrategy.state.permissionMode = "block";
    const ctx = makeCtx("Allow once");

    const result = await uiStrategy.handleMcpToolCall(
      { tool: "some_tool" },
      ctx as unknown as never,
    );

    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
    expect(ctx.selectCalls.length).toBe(0);
  });
});

// ============================================================================
// onViewLevel
// ============================================================================

describe("UIPermissionStrategy: onViewLevel", () => {
  test("calls ctx.ui.select with level options", async () => {
    const strategy = createUIPermissionStrategy();
    const ctx = makeCtx() as unknown as TestCommandContext;

    await (strategy as any).onViewLevel(ctx);

    expect(ctx.selectCalls.length).toBe(1);
    expect(ctx.selectCalls[0].message).toBe("Select permission level");
    const options = ctx.selectCalls[0].options;
    expect(options).toContain("Minimal: Read-only ← current");
    expect(options).toContain("Low: File ops only");
    expect(options).toContain("Medium: Dev operations");
    expect(options).toContain("High: Full operations");
    expect(options).toContain("Bypassed: All checks disabled");
  });

  test("selecting a level updates state", async () => {
    const strategy = createUIPermissionStrategy();
    // First select: "Low: File ops only"
    // Second select: "Session only"
    const ctx = makeCtx("Session only");
    let callCount = 0;
    ctx.ui.select = async (_message: string, options: string[]) => {
      callCount++;
      if (callCount === 1) {
        // Find and return "Low: File ops only"
        const lowOpt = options.find((o) => o.startsWith("Low:"));
        return lowOpt || undefined;
      }
      return "Session only";
    };

    await (strategy as any).onViewLevel(ctx as unknown as TestCommandContext);

    expect(strategy.state.currentLevel).toBe("low");
  });

  test("selecting a level with global save", async () => {
    const strategy = createUIPermissionStrategy();
    const ctx = makeCtx("Global (persists)");
    let callCount = 0;
    ctx.ui.select = async (_message: string, options: string[]) => {
      callCount++;
      if (callCount === 1) {
        const mediumOpt = options.find((o) => o.startsWith("Medium:"));
        return mediumOpt || undefined;
      }
      return "Global (persists)";
    };

    await (strategy as any).onViewLevel(ctx as unknown as TestCommandContext);

    expect(strategy.state.currentLevel).toBe("medium");
    expect(strategy.state.isSessionOnly).toBe(false);
  });

  test("canceling first select does nothing", async () => {
    const strategy = createUIPermissionStrategy();
    const ctx = makeCtx("Cancel");

    await (strategy as any).onViewLevel(ctx as unknown as TestCommandContext);

    expect(strategy.state.currentLevel).toBe("minimal");
  });

  test("canceling second select does nothing", async () => {
    const strategy = createUIPermissionStrategy();
    const ctx = makeCtx("Cancel");
    let callCount = 0;
    ctx.ui.select = async (_message: string, options: string[]) => {
      callCount++;
      if (callCount === 1) {
        const highOpt = options.find((o) => o.startsWith("High:"));
        return highOpt || undefined;
      }
      return undefined;
    };

    await (strategy as any).onViewLevel(ctx as unknown as TestCommandContext);

    expect(strategy.state.currentLevel).toBe("minimal");
  });
});

// ============================================================================
// onSetLevel
// ============================================================================

describe("UIPermissionStrategy: onSetLevel", () => {
  test("calls ctx.ui.select for scope", async () => {
    const strategy = createUIPermissionStrategy();
    const ctx = makeCtx("Session only") as unknown as TestCommandContext;

    await (strategy as any).onSetLevel("high", ctx);

    expect(ctx.selectCalls.length).toBe(1);
    expect(ctx.selectCalls[0].message).toBe("Save permission level to:");
    expect(ctx.selectCalls[0].options).toContain("Session only");
    expect(ctx.selectCalls[0].options).toContain("Global (persists)");
  });

  test("session-only scope sets isSessionOnly: true", async () => {
    const strategy = createUIPermissionStrategy();
    const ctx = makeCtx("Session only") as unknown as TestCommandContext;

    await (strategy as any).onSetLevel("high", ctx);

    expect(strategy.state.currentLevel).toBe("high");
    expect(strategy.state.isSessionOnly).toBe(true);
  });

  test("global scope sets isSessionOnly: false", async () => {
    const strategy = createUIPermissionStrategy();
    const ctx = makeCtx("Global (persists)") as unknown as TestCommandContext;

    await (strategy as any).onSetLevel("medium", ctx);

    expect(strategy.state.currentLevel).toBe("medium");
    expect(strategy.state.isSessionOnly).toBe(false);
  });

  test("canceling scope selection does nothing", async () => {
    const strategy = createUIPermissionStrategy();
    const ctx = makeCtx(CANCEL) as unknown as TestCommandContext;

    await (strategy as any).onSetLevel("high", ctx);

    expect(strategy.state.currentLevel).toBe("minimal");
    expect(strategy.state.isSessionOnly).toBe(false);
  });
});

// ============================================================================
// onViewMode
// ============================================================================

describe("UIPermissionStrategy: onViewMode", () => {
  test("calls ctx.ui.select with mode options", async () => {
    const strategy = createUIPermissionStrategy();
    const ctx = makeCtx() as unknown as TestCommandContext;

    await (strategy as any).onViewMode(ctx);

    expect(ctx.selectCalls.length).toBe(1);
    expect(ctx.selectCalls[0].message).toBe("Select permission mode");
    const options = ctx.selectCalls[0].options;
    expect(options).toContain(
      "Ask: Prompt when permission is required ← current",
    );
    expect(options).toContain("Block: Block instead of prompting");
  });

  test("selecting a mode updates state", async () => {
    const strategy = createUIPermissionStrategy();
    const ctx = makeCtx("Session only");
    let callCount = 0;
    ctx.ui.select = async (_message: string, options: string[]) => {
      callCount++;
      if (callCount === 1) {
        const blockOpt = options.find((o) => o.startsWith("Block:"));
        return blockOpt || undefined;
      }
      return "Session only";
    };

    await (strategy as any).onViewMode(ctx as unknown as TestCommandContext);

    expect(strategy.state.permissionMode).toBe("block");
  });
});

// ============================================================================
// onSetMode
// ============================================================================

describe("UIPermissionStrategy: onSetMode", () => {
  test("calls ctx.ui.select for scope", async () => {
    const strategy = createUIPermissionStrategy();
    const ctx = makeCtx("Session only") as unknown as TestCommandContext;

    await (strategy as any).onSetMode("block", ctx);

    expect(ctx.selectCalls.length).toBe(1);
    expect(ctx.selectCalls[0].message).toBe("Save permission mode to:");
    expect(ctx.selectCalls[0].options).toContain("Session only");
    expect(ctx.selectCalls[0].options).toContain("Global (persists)");
  });

  test("session-only scope sets isModeSessionOnly: true", async () => {
    const strategy = createUIPermissionStrategy();
    const ctx = makeCtx("Session only") as unknown as TestCommandContext;

    await (strategy as any).onSetMode("block", ctx);

    expect(strategy.state.permissionMode).toBe("block");
    expect(strategy.state.isModeSessionOnly).toBe(true);
  });

  test("global scope sets isModeSessionOnly: false", async () => {
    const strategy = createUIPermissionStrategy();
    const ctx = makeCtx("Global (persists)") as unknown as TestCommandContext;

    await (strategy as any).onSetMode("ask", ctx);

    expect(strategy.state.permissionMode).toBe("ask");
    expect(strategy.state.isModeSessionOnly).toBe(false);
  });
});
