/**
 * Tests for permission prompt UI behavior
 *
 * Covers handleBashToolCall_UI, handleMcpToolCall_UI,
 * handleWriteToolCall_UI, and the requestPermission helper (tested indirectly).
 *
 * Run with: npm test
 */
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { describe, expect, test } from "vitest";
import type { PermissionState } from "../src/core/interfaces";
import {
  handleBashToolCall as handleBashToolCall_UI,
  handleMcpToolCall as handleMcpToolCall_UI,
  handleWriteToolCall as handleWriteToolCall_UI,
} from "../src/ui/handlers";
import {
  handleBashToolCall as handleBashToolCall_noUI,
  handleMcpToolCall as handleMcpToolCall_noUI,
  handleWriteToolCall as handleWriteToolCall_noUI,
} from "../src/no-ui/handlers";
import { createInitialState } from "../src/ui/state";

// ============================================================================
// Mock context factory
// ============================================================================

interface SelectCall {
  message: string;
  options: string[];
}

interface NotifyCall {
  message: string;
  type: string;
}

interface MockCtx {
  ui: {
    select: (message: string, options: string[]) => Promise<string | null>;
    notify: (message: string, type: string) => void;
    setStatus: (key: string, value: string) => void;
  };
  selectCalls: SelectCall[];
  notifyCalls: NotifyCall[];
}

const makeCtx = (selectResponse: string | null = "Cancel"): MockCtx => {
  const selectCalls: SelectCall[] = [];
  const notifyCalls: NotifyCall[] = [];

  return {
    ui: {
      select: async (message: string, options: string[]) => {
        selectCalls.push({ message, options });
        return selectResponse;
      },
      notify: (message: string, type: string) => {
        notifyCalls.push({ message, type });
      },
      setStatus: () => {},
    },
    selectCalls,
    notifyCalls,
  };
};

/** State at minimal level (default) */
const minimalState = (): PermissionState => {
  return createInitialState(); // defaults to minimal
};

/** State at a specific level */
const stateAt = (level: PermissionState["currentLevel"]): PermissionState => {
  const s = createInitialState();
  s.currentLevel = level;
  return s;
};

// ============================================================================
// handleBashToolCall - command displayed in prompt
// ============================================================================

describe("bash prompt: command shown with $ prefix in message", () => {
  test("command shown with $ prefix", async () => {
    const state = minimalState();
    const ctx = makeCtx("Cancel");

    await handleBashToolCall_UI(
      state,
      "git push origin main",
      ctx as unknown as ExtensionContext,
    );

    expect(ctx.selectCalls.length).toBeGreaterThan(0);
    const { message } = ctx.selectCalls[0];
    expect(message).toMatch(/^\$ git push origin main/);
  });
});

describe("bash prompt: short command is not truncated", () => {
  test("short command not truncated", async () => {
    const state = minimalState();
    const ctx = makeCtx("Cancel");

    await handleBashToolCall_UI(
      state,
      "npm install",
      ctx as unknown as ExtensionContext,
    );

    expect(ctx.selectCalls.length).toBeGreaterThan(0);
    const { message } = ctx.selectCalls[0];
    expect(message).toContain("npm install");
    expect(message).not.toContain("…");
  });
});

describe("bash prompt: long command is truncated with ellipsis", () => {
  test("long command truncated", async () => {
    const state = minimalState();
    const ctx = makeCtx("Cancel");

    const longCmd = "git commit -m '" + "x".repeat(80) + "'";
    await handleBashToolCall_UI(
      state,
      longCmd,
      ctx as unknown as ExtensionContext,
    );

    expect(ctx.selectCalls.length).toBeGreaterThan(0);
    const { message } = ctx.selectCalls[0];
    expect(message).toContain("…");
    const displayedCmd = message.split("  [")[0];
    expect(displayedCmd.length).toBeLessThanOrEqual(83);
  });
});

describe("bash prompt: required level shown in message", () => {
  test("high level shown", async () => {
    const state = minimalState();
    const ctx = makeCtx("Cancel");

    await handleBashToolCall_UI(
      state,
      "git push origin main",
      ctx as unknown as ExtensionContext,
    );

    expect(ctx.selectCalls.length).toBeGreaterThan(0);
    const { message } = ctx.selectCalls[0];
    expect(message).toContain("[requires High]");
  });

  test("medium level shown", async () => {
    const state = minimalState();
    const ctx = makeCtx("Cancel");

    await handleBashToolCall_UI(
      state,
      "npm install",
      ctx as unknown as ExtensionContext,
    );

    expect(ctx.selectCalls.length).toBeGreaterThan(0);
    const { message } = ctx.selectCalls[0];
    expect(message).toContain("[requires Medium]");
  });
});

// ============================================================================
// handleBashToolCall - options
// ============================================================================

describe("bash prompt: options include Allow once, Allow all, Cancel", () => {
  test("options include correct choices", async () => {
    const state = minimalState();
    const ctx = makeCtx("Cancel");

    await handleBashToolCall_UI(
      state,
      "git push",
      ctx as unknown as ExtensionContext,
    );

    expect(ctx.selectCalls.length).toBeGreaterThan(0);
    const { options } = ctx.selectCalls[0];
    expect(options).toContain("Allow once");
    expect(options).toContain("Cancel");
    expect(options.some((o) => o.startsWith("Allow all"))).toBe(true);
  });
});

describe("bash prompt: Allow all option includes level and (session)", () => {
  test("high level Allow all", async () => {
    const state = minimalState();
    const ctx = makeCtx("Cancel");

    await handleBashToolCall_UI(
      state,
      "git push",
      ctx as unknown as ExtensionContext,
    );

    const { options } = ctx.selectCalls[0];
    const allowAll = options.find((o) => o.startsWith("Allow all"));
    expect(allowAll).toBe("Allow all High (session)");
  });

  test("medium level Allow all", async () => {
    const state = minimalState();
    const ctx = makeCtx("Cancel");

    await handleBashToolCall_UI(
      state,
      "npm install",
      ctx as unknown as ExtensionContext,
    );

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
    const state = minimalState();
    const ctx = makeCtx("Allow once");

    const result = await handleBashToolCall_UI(
      state,
      "git push",
      ctx as unknown as ExtensionContext,
    );
    expect(result).toBeUndefined();
  });
});

describe("bash: Cancel returns block result", () => {
  test("Cancel", async () => {
    const state = minimalState();
    const ctx = makeCtx("Cancel");

    const result = await handleBashToolCall_UI(
      state,
      "git push",
      ctx as unknown as ExtensionContext,
    );
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
    expect(result!.reason).toContain("Cancelled");
  });
});

describe("bash: Allow all upgrades state level for session", () => {
  test("Allow all High", async () => {
    const state = minimalState();
    const ctx = makeCtx("Allow all High (session)");

    const result = await handleBashToolCall_UI(
      state,
      "git push",
      ctx as unknown as ExtensionContext,
    );
    expect(result).toBeUndefined();
    expect(state.currentLevel).toBe("high");
    expect(state.isSessionOnly).toBe(true);
  });

  test("Allow all Medium", async () => {
    const state = minimalState();
    const ctx = makeCtx("Allow all Medium (session)");

    const result = await handleBashToolCall_UI(
      state,
      "npm install",
      ctx as unknown as ExtensionContext,
    );
    expect(result).toBeUndefined();
    expect(state.currentLevel).toBe("medium");
  });
});

describe("bash: sufficient permission - no prompt shown", () => {
  test("no prompt when permission sufficient", async () => {
    const state = stateAt("high");
    const ctx = makeCtx("Cancel");

    const result = await handleBashToolCall_UI(
      state,
      "git push",
      ctx as unknown as ExtensionContext,
    );
    expect(result).toBeUndefined();
    expect(ctx.selectCalls.length).toBe(0);
  });
});

describe("bash: minimal commands always pass through without prompt", () => {
  test("minimal commands pass", async () => {
    const state = minimalState();
    const ctx = makeCtx("Cancel");

    const result = await handleBashToolCall_UI(
      state,
      "ls -la",
      ctx as unknown as ExtensionContext,
    );
    expect(result).toBeUndefined();
    expect(ctx.selectCalls.length).toBe(0);
  });
});

describe("bash: bypassed level skips all checks", () => {
  test("bypassed level", async () => {
    const state = stateAt("bypassed");
    const ctx = makeCtx("Cancel");

    const result = await handleBashToolCall_UI(
      state,
      "sudo rm -rf /",
      ctx as unknown as ExtensionContext,
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
    const state = minimalState();
    const ctx = makeCtx("Cancel");

    await handleBashToolCall_UI(
      state,
      "rm -rf /tmp/test",
      ctx as unknown as ExtensionContext,
    );

    expect(ctx.selectCalls.length).toBeGreaterThan(0);
    const { message } = ctx.selectCalls[0];
    expect(message).toMatch(/^⚠️ Dangerous: \$ /);
    expect(message).toContain("rm -rf /tmp/test");
  });
});

describe("dangerous: options are Allow once and Cancel only", () => {
  test("dangerous options", async () => {
    const state = minimalState();
    const ctx = makeCtx("Cancel");

    await handleBashToolCall_UI(
      state,
      "sudo apt-get install pkg",
      ctx as unknown as ExtensionContext,
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
    const state = minimalState();
    const ctx = makeCtx("Allow once");

    const result = await handleBashToolCall_UI(
      state,
      "rm -rf /tmp/test",
      ctx as unknown as ExtensionContext,
    );
    expect(result).toBeUndefined();
  });
});

describe("dangerous: Cancel blocks command", () => {
  test("dangerous Cancel", async () => {
    const state = minimalState();
    const ctx = makeCtx("Cancel");

    const result = await handleBashToolCall_UI(
      state,
      "rm -rf /tmp/test",
      ctx as unknown as ExtensionContext,
    );
    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
  });
});

describe("dangerous: long dangerous command is truncated in title", () => {
  test("long dangerous command truncated", async () => {
    const state = minimalState();
    const ctx = makeCtx("Cancel");

    const longDangerousCmd = "sudo rm -rf /tmp/" + "a".repeat(100);
    await handleBashToolCall_UI(
      state,
      longDangerousCmd,
      ctx as unknown as ExtensionContext,
    );

    const { message } = ctx.selectCalls[0];
    expect(message).toContain("…");
  });
});

// ============================================================================
// handleWriteToolCall
// ============================================================================

describe("write: prompts at minimal level", () => {
  test("write minimal", async () => {
    const state = minimalState();
    const ctx = makeCtx("Cancel");

    const result = await handleWriteToolCall_UI({
      state,
      toolName: "write",
      filePath: "/tmp/file.txt",
      ctx: ctx as unknown as ExtensionContext,
    });

    expect(result).toBeDefined();
    expect(ctx.selectCalls.length).toBeGreaterThan(0);
  });
});

describe("write: no prompt at low or above", () => {
  test("write low", async () => {
    const state = stateAt("low");
    const ctx = makeCtx("Cancel");

    const result = await handleWriteToolCall_UI({
      state,
      toolName: "write",
      filePath: "/tmp/file.txt",
      ctx: ctx as unknown as ExtensionContext,
    });

    expect(result).toBeUndefined();
    expect(ctx.selectCalls.length).toBe(0);
  });
});

describe("write: prompt title includes file path", () => {
  test("write file path in message", async () => {
    const state = minimalState();
    const ctx = makeCtx("Cancel");

    await handleWriteToolCall_UI({
      state,
      toolName: "write",
      filePath: "/src/index.ts",
      ctx: ctx as unknown as ExtensionContext,
    });

    expect(ctx.selectCalls.length).toBeGreaterThan(0);
    const { message } = ctx.selectCalls[0];
    expect(message).toContain("/src/index.ts");
  });
});

describe("write: Allow all upgrades state to low", () => {
  test("write Allow all", async () => {
    const state = minimalState();
    const ctx = makeCtx("Allow all Low (session)");

    const result = await handleWriteToolCall_UI({
      state,
      toolName: "write",
      filePath: "/tmp/file.txt",
      ctx: ctx as unknown as ExtensionContext,
    });

    expect(result).toBeUndefined();
    expect(state.currentLevel).toBe("low");
  });
});

// ============================================================================
// handleMcpToolCall
// ============================================================================

describe("mcp: prompts at minimal level with tool name", () => {
  test("mcp minimal", async () => {
    const state = minimalState();
    const ctx = makeCtx("Cancel");

    await handleMcpToolCall_UI(
      state,
      { tool: "filesystem_read" },
      ctx as unknown as ExtensionContext,
    );

    expect(ctx.selectCalls.length).toBeGreaterThan(0);
    const { message } = ctx.selectCalls[0];
    expect(message).toContain("filesystem_read");
  });
});

describe("mcp: no prompt at medium or above", () => {
  test("mcp medium", async () => {
    const state = stateAt("medium");
    const ctx = makeCtx("Cancel");

    await handleMcpToolCall_UI(
      state,
      { tool: "some_tool" },
      ctx as unknown as ExtensionContext,
    );

    expect(ctx.selectCalls.length).toBe(0);
    expect(ctx.notifyCalls.some((n) => n.message.includes("some_tool"))).toBe(
      true,
    );
  });
});

describe("mcp: unknown args still show a prompt", () => {
  test("mcp unknown args", async () => {
    const state = minimalState();
    const ctx = makeCtx("Cancel");

    await handleMcpToolCall_UI(
      state,
      { action: "unknown_action" },
      ctx as unknown as ExtensionContext,
    );

    expect(ctx.selectCalls.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Block mode
// ============================================================================

describe("block mode: blocks without prompting", () => {
  test("block mode", async () => {
    const state = minimalState();
    state.permissionMode = "block";
    const ctx = makeCtx("Allow once");

    const result = await handleBashToolCall_UI(
      state,
      "git push",
      ctx as unknown as ExtensionContext,
    );

    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
    expect(ctx.selectCalls.length).toBe(0);
    expect(result!.reason).toContain("block");
  });

  test("block mode dangerous", async () => {
    const state = minimalState();
    state.permissionMode = "block";
    const ctx = makeCtx("Allow once");

    const result = await handleBashToolCall_UI(
      state,
      "rm -rf /tmp",
      ctx as unknown as ExtensionContext,
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
    const state = minimalState();

    const result = handleBashToolCall_noUI(state, "git push");

    expect(result).toBeDefined();
    expect(result!.block).toBe(true);
  });
});
