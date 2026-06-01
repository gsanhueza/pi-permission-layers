/**
 * Tests for parseMcpInput — MCP input parsing logic.
 *
 * Run with: npm test
 */

import { describe, expect, test } from "vitest";
import { parseMcpInput } from "../src/strategies/internal/mcp-input";

// ============================================================================
// HELPERS
// ============================================================================

const makeConfig = (
  overrides?: Partial<Record<string, string[]>>,
): Record<string, string[]> | undefined => {
  if (!overrides) return undefined;
  const result: Record<string, string[]> = {};
  for (const [key, values] of Object.entries(overrides)) {
    if (values) result[key] = [...values];
  }
  return result;
};

// ============================================================================
// tool field
// ============================================================================

describe("parseMcpInput: tool field", () => {
  test("basic tool input", () => {
    const result = parseMcpInput({ tool: "filesystem_read" });
    expect(result.targetTool).toBe("filesystem_read");
    expect(result.mode).toBe("call");
    expect(result.requiredLevel).toBe("medium");
    expect(result.dangerous).toBe(false);
  });

  test("tool with mode — mode overridden to 'call'", () => {
    const result = parseMcpInput({
      tool: "github_create_issue",
      mode: "call",
    });
    expect(result.targetTool).toBe("github_create_issue");
    expect(result.mode).toBe("call");
  });

  test("tool with user config — uses config level", () => {
    const config = makeConfig({ low: ["my_custom_tool"] });
    const result = parseMcpInput({ tool: "my_custom_tool" }, config);
    expect(result.targetTool).toBe("my_custom_tool");
    expect(result.mode).toBe("call");
    expect(result.requiredLevel).toBe("low");
    expect(result.dangerous).toBe(false);
  });
});

// ============================================================================
// connect field
// ============================================================================

describe("parseMcpInput: connect field", () => {
  test("connect input", () => {
    const result = parseMcpInput({ connect: "my-server" });
    expect(result.targetTool).toBe("connect(my-server)");
    expect(result.mode).toBe("connect");
  });

  test("connect is a known mode — defaults to minimal", () => {
    const result = parseMcpInput({ connect: "my-server" });
    expect(result.requiredLevel).toBe("minimal");
    expect(result.dangerous).toBe(false);
  });
});

// ============================================================================
// describe field
// ============================================================================

describe("parseMcpInput: describe field", () => {
  test("describe input", () => {
    const result = parseMcpInput({ describe: "my-tool" });
    expect(result.targetTool).toBe("describe(my-tool)");
    expect(result.mode).toBe("describe");
  });

  test("describe is a known mode — defaults to minimal", () => {
    const result = parseMcpInput({ describe: "my-tool" });
    expect(result.requiredLevel).toBe("minimal");
    expect(result.dangerous).toBe(false);
  });
});

// ============================================================================
// search field
// ============================================================================

describe("parseMcpInput: search field", () => {
  test("search input", () => {
    const result = parseMcpInput({ search: "foo bar" });
    expect(result.targetTool).toBe("search(foo bar)");
    expect(result.mode).toBe("search");
  });

  test("search is a known mode — defaults to minimal", () => {
    const result = parseMcpInput({ search: "foo bar" });
    expect(result.requiredLevel).toBe("minimal");
    expect(result.dangerous).toBe(false);
  });
});

// ============================================================================
// server field
// ============================================================================

describe("parseMcpInput: server field", () => {
  test("server input", () => {
    const result = parseMcpInput({ server: "github" });
    expect(result.targetTool).toBe("list(github)");
    expect(result.mode).toBe("list");
  });

  test("server/list is a known mode — defaults to minimal", () => {
    const result = parseMcpInput({ server: "github" });
    expect(result.requiredLevel).toBe("minimal");
    expect(result.dangerous).toBe(false);
  });
});

// ============================================================================
// action field
// ============================================================================

describe("parseMcpInput: action field", () => {
  test("action input", () => {
    const result = parseMcpInput({ action: "deploy" });
    expect(result.targetTool).toBe("action(deploy)");
    expect(result.mode).toBe("action");
  });

  test("action is a known mode — defaults to medium", () => {
    const result = parseMcpInput({ action: "deploy" });
    expect(result.requiredLevel).toBe("medium");
    expect(result.dangerous).toBe(false);
  });
});

// ============================================================================
// empty/unknown input
// ============================================================================

describe("parseMcpInput: empty/unknown input", () => {
  test("empty object → status defaults", () => {
    const result = parseMcpInput({});
    expect(result.targetTool).toBe("status");
    expect(result.mode).toBe("status");
  });

  test("unknown fields → status defaults", () => {
    const result = parseMcpInput({
      foo: "bar",
      baz: 42,
    });
    expect(result.targetTool).toBe("status");
    expect(result.mode).toBe("status");
  });

  test("null/undefined values ignored → status defaults", () => {
    const result = parseMcpInput({
      tool: undefined,
      connect: undefined,
    } as never);
    expect(result.targetTool).toBe("status");
    expect(result.mode).toBe("status");
  });

  test("status is a known mode — defaults to minimal", () => {
    const result = parseMcpInput({});
    expect(result.requiredLevel).toBe("minimal");
    expect(result.dangerous).toBe(false);
  });
});

// ============================================================================
// priority: tool > connect > describe > search > server > action > status
// ============================================================================

describe("parseMcpInput: field priority", () => {
  test("tool takes priority over connect", () => {
    const result = parseMcpInput({
      tool: "my-tool",
      connect: "ignored",
    });
    expect(result.targetTool).toBe("my-tool");
    expect(result.mode).toBe("call");
  });

  test("connect takes priority over describe", () => {
    const result = parseMcpInput({
      connect: "my-server",
      describe: "ignored",
    });
    expect(result.targetTool).toBe("connect(my-server)");
    expect(result.mode).toBe("connect");
  });

  test("describe takes priority over search", () => {
    const result = parseMcpInput({
      describe: "my-tool",
      search: "ignored",
    });
    expect(result.targetTool).toBe("describe(my-tool)");
    expect(result.mode).toBe("describe");
  });

  test("search takes priority over server", () => {
    const result = parseMcpInput({
      search: "query",
      server: "ignored",
    });
    expect(result.targetTool).toBe("search(query)");
    expect(result.mode).toBe("search");
  });

  test("server takes priority over action", () => {
    const result = parseMcpInput({
      server: "my-server",
      action: "ignored",
    });
    expect(result.targetTool).toBe("list(my-server)");
    expect(result.mode).toBe("list");
  });

  test("action takes priority over status (fallback)", () => {
    const result = parseMcpInput({ action: "deploy" });
    expect(result.targetTool).toBe("action(deploy)");
    expect(result.mode).toBe("action");
  });
});

// ============================================================================
// dangerous classification from config
// ============================================================================

describe("parseMcpInput: dangerous classification", () => {
  test("config marks tool as dangerous → requiredLevel is high", () => {
    const config = makeConfig({ dangerous: ["dangerous_tool"] });
    const result = parseMcpInput({ tool: "dangerous_tool" }, config);
    expect(result.targetTool).toBe("dangerous_tool");
    expect(result.mode).toBe("call");
    expect(result.requiredLevel).toBe("high");
    expect(result.dangerous).toBe(true);
  });

  test("config marks mode as dangerous → requiredLevel is high", () => {
    const config = makeConfig({ dangerous: ["call"] });
    const result = parseMcpInput({ tool: "unknown_tool" }, config);
    expect(result.targetTool).toBe("unknown_tool");
    expect(result.mode).toBe("call");
    expect(result.requiredLevel).toBe("high");
    expect(result.dangerous).toBe(true);
  });
});
