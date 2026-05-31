/**
 * Tests for MCP permission classification
 *
 * Run with: npm test
 */

import { describe, expect, test } from "vitest";
import { resolveMcpLevel } from "../src/core/classifiers/mcp-classifier";
import type { McpPermissionConfig } from "../src/core/interfaces";

// ============================================================================
// resolveMcpLevel — mode-based resolution
// ============================================================================

describe("resolveMcpLevel: mode-based resolution", () => {
  test("read-only modes default to minimal", () => {
    expect(resolveMcpLevel("any_tool", "search", undefined)).toEqual({
      level: "minimal",
      dangerous: false,
    });
    expect(resolveMcpLevel("any_tool", "describe", undefined)).toEqual({
      level: "minimal",
      dangerous: false,
    });
    expect(resolveMcpLevel("any_tool", "list", undefined)).toEqual({
      level: "minimal",
      dangerous: false,
    });
    expect(resolveMcpLevel("any_tool", "status", undefined)).toEqual({
      level: "minimal",
      dangerous: false,
    });
    expect(resolveMcpLevel("any_tool", "connect", undefined)).toEqual({
      level: "minimal",
      dangerous: false,
    });
  });

  test("call mode for known read-only tools defaults to low", () => {
    expect(resolveMcpLevel("github_list_commits", "call", undefined)).toEqual({
      level: "low",
      dangerous: false,
    });
    expect(resolveMcpLevel("serper_search", "call", undefined)).toEqual({
      level: "low",
      dangerous: false,
    });
    expect(
      resolveMcpLevel("atlassian_getJiraIssue", "call", undefined),
    ).toEqual({
      level: "low",
      dangerous: false,
    });
  });

  test("unknown tools in call mode return null (caller treats as medium)", () => {
    expect(resolveMcpLevel("unknown_tool", "call", undefined)).toBeNull();
    expect(resolveMcpLevel("some_new_tool", "call", undefined)).toBeNull();
  });

  test("action mode returns null (not a known mode)", () => {
    expect(resolveMcpLevel("any_tool", "action", undefined)).toBeNull();
  });
});

// ============================================================================
// resolveMcpLevel — tool name override
// ============================================================================

describe("resolveMcpLevel: tool name override", () => {
  test("user config overrides specific tool", () => {
    const config: McpPermissionConfig = { minimal: ["serper_search"] };
    expect(resolveMcpLevel("serper_search", "call", config)).toEqual({
      level: "minimal",
      dangerous: false,
    });
  });

  test("user config can move tool to higher level", () => {
    const config: McpPermissionConfig = { medium: ["github_list_commits"] };
    expect(resolveMcpLevel("github_list_commits", "call", config)).toEqual({
      level: "medium",
      dangerous: false,
    });
  });

  test("user config marks MCP tool as dangerous", () => {
    const config: McpPermissionConfig = { dangerous: ["github_create_issue"] };
    expect(resolveMcpLevel("github_create_issue", "call", config)).toEqual({
      level: "high",
      dangerous: true,
    });
  });
});

// ============================================================================
// resolveMcpLevel — mode override
// ============================================================================

describe("resolveMcpLevel: mode override", () => {
  test("user config overrides mode", () => {
    const config: McpPermissionConfig = { minimal: ["search"] };
    expect(resolveMcpLevel("some_tool", "search", config)).toEqual({
      level: "minimal",
      dangerous: false,
    });
  });

  test("user config can raise mode level", () => {
    const config: McpPermissionConfig = { low: ["search"] };
    expect(resolveMcpLevel("any_tool", "search", config)).toEqual({
      level: "low",
      dangerous: false,
    });
  });
});

// ============================================================================
// resolveMcpLevel — tool name precedence over mode
// ============================================================================

describe("resolveMcpLevel: tool name takes precedence over mode", () => {
  test("tool name match wins over mode match", () => {
    const config: McpPermissionConfig = {
      minimal: ["github_list_commits"],
      low: ["call"],
    };
    expect(resolveMcpLevel("github_list_commits", "call", config)).toEqual({
      level: "minimal",
      dangerous: false,
    });
  });

  test("tool name in low, mode in minimal — tool name wins", () => {
    const config: McpPermissionConfig = {
      minimal: ["search"],
      low: ["serper_search"],
    };
    expect(resolveMcpLevel("serper_search", "search", config)).toEqual({
      level: "low",
      dangerous: false,
    });
  });
});

// ============================================================================
// resolveMcpLevel — most restrictive wins
// ============================================================================

describe("resolveMcpLevel: most restrictive wins", () => {
  test("tool in multiple levels — most restrictive wins", () => {
    const config: McpPermissionConfig = {
      minimal: ["serper_search"],
      low: ["serper_search"],
    };
    expect(resolveMcpLevel("serper_search", "call", config)).toEqual({
      level: "low",
      dangerous: false,
    });
  });
});

// ============================================================================
// resolveMcpLevel — delta model
// ============================================================================

describe("resolveMcpLevel: delta model — defaults preserved", () => {
  test("unmentioned tools keep defaults", () => {
    const config: McpPermissionConfig = { minimal: ["search"] };
    expect(resolveMcpLevel("any_tool", "search", config)).toEqual({
      level: "minimal",
      dangerous: false,
    });
    expect(resolveMcpLevel("github_list_commits", "call", config)).toEqual({
      level: "low",
      dangerous: false,
    });
    expect(resolveMcpLevel("unknown_tool", "call", config)).toBeNull();
  });
});

// ============================================================================
// Integration: MCP config + defaults
// ============================================================================

describe("integration: MCP config with defaults", () => {
  test("mixed config — overrides and defaults coexist", () => {
    const config: McpPermissionConfig = {
      minimal: ["serper_search"],
      medium: ["github_create_issue"],
    };
    expect(resolveMcpLevel("serper_search", "call", config)).toEqual({
      level: "minimal",
      dangerous: false,
    });
    expect(resolveMcpLevel("github_create_issue", "call", config)).toEqual({
      level: "medium",
      dangerous: false,
    });
    expect(resolveMcpLevel("github_list_commits", "call", config)).toEqual({
      level: "low",
      dangerous: false,
    });
  });

  test("empty config preserves all defaults", () => {
    expect(resolveMcpLevel("any", "search", {})).toEqual({
      level: "minimal",
      dangerous: false,
    });
    expect(resolveMcpLevel("github_list_commits", "call", {})).toEqual({
      level: "low",
      dangerous: false,
    });
    expect(resolveMcpLevel("unknown", "call", {})).toBeNull();
  });
});
