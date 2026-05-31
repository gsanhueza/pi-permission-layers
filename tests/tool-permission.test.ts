/**
 * Tests for tool permission classification
 *
 * Run with: npm test
 */

import { describe, expect, test } from "vitest";
import { resolveToolLevel } from "../src/core/classifiers/tool-classifier";
import type { ToolPermissionConfig } from "../src/core/interfaces";

// ============================================================================
// resolveToolLevel — default resolution
// ============================================================================

describe("resolveToolLevel: default resolution", () => {
  test("read tools default to minimal", () => {
    expect(resolveToolLevel("read", undefined)).toEqual({
      level: "minimal",
      dangerous: false,
    });
    expect(resolveToolLevel("ls", undefined)).toEqual({
      level: "minimal",
      dangerous: false,
    });
    expect(resolveToolLevel("grep", undefined)).toEqual({
      level: "minimal",
      dangerous: false,
    });
    expect(resolveToolLevel("find", undefined)).toEqual({
      level: "minimal",
      dangerous: false,
    });
  });

  test("write/edit default to low", () => {
    expect(resolveToolLevel("write", undefined)).toEqual({
      level: "low",
      dangerous: false,
    });
    expect(resolveToolLevel("edit", undefined)).toEqual({
      level: "low",
      dangerous: false,
    });
  });

  test("unknown tools return null", () => {
    expect(resolveToolLevel("unknown-tool", undefined)).toBeNull();
    expect(resolveToolLevel("random-cmd", undefined)).toBeNull();
  });
});

// ============================================================================
// resolveToolLevel — user config overrides
// ============================================================================

describe("resolveToolLevel: user config overrides", () => {
  test("user config moves tool to different level", () => {
    const config: ToolPermissionConfig = { minimal: ["read"] };
    expect(resolveToolLevel("read", config)).toEqual({
      level: "minimal",
      dangerous: false,
    });
  });

  test("user config moves read tool to low", () => {
    const config: ToolPermissionConfig = { low: ["read"] };
    expect(resolveToolLevel("read", config)).toEqual({
      level: "low",
      dangerous: false,
    });
  });

  test("user config moves write to medium", () => {
    const config: ToolPermissionConfig = { medium: ["write"] };
    expect(resolveToolLevel("write", config)).toEqual({
      level: "medium",
      dangerous: false,
    });
  });

  test("user config marks tool as dangerous", () => {
    const config: ToolPermissionConfig = { dangerous: ["edit"] };
    expect(resolveToolLevel("edit", config)).toEqual({
      level: "high",
      dangerous: true,
    });
  });

  test("unknown tool with config still returns null", () => {
    const config: ToolPermissionConfig = { minimal: ["read"] };
    expect(resolveToolLevel("unknown", config)).toBeNull();
  });
});

// ============================================================================
// resolveToolLevel — most restrictive wins
// ============================================================================

describe("resolveToolLevel: most restrictive wins", () => {
  test("tool in multiple levels — most restrictive wins", () => {
    const config: ToolPermissionConfig = {
      minimal: ["read"],
      low: ["read", "write"],
      medium: ["write"],
    };
    expect(resolveToolLevel("read", config)).toEqual({
      level: "low",
      dangerous: false,
    });
    expect(resolveToolLevel("write", config)).toEqual({
      level: "medium",
      dangerous: false,
    });
  });

  test("dangerous always wins over other levels", () => {
    const config: ToolPermissionConfig = {
      minimal: ["edit"],
      low: ["edit"],
      medium: ["edit"],
      high: ["edit"],
      dangerous: ["edit"],
    };
    expect(resolveToolLevel("edit", config)).toEqual({
      level: "high",
      dangerous: true,
    });
  });
});

// ============================================================================
// resolveToolLevel — delta model
// ============================================================================

describe("resolveToolLevel: delta model — defaults preserved", () => {
  test("unmentioned tools keep defaults", () => {
    const config: ToolPermissionConfig = { minimal: ["read"] };
    expect(resolveToolLevel("read", config)).toEqual({
      level: "minimal",
      dangerous: false,
    });
    expect(resolveToolLevel("ls", config)).toEqual({
      level: "minimal",
      dangerous: false,
    });
    expect(resolveToolLevel("find", config)).toEqual({
      level: "minimal",
      dangerous: false,
    });
    expect(resolveToolLevel("write", config)).toEqual({
      level: "low",
      dangerous: false,
    });
    expect(resolveToolLevel("edit", config)).toEqual({
      level: "low",
      dangerous: false,
    });
  });

  test("only changing one level preserves all others", () => {
    const config: ToolPermissionConfig = { low: ["grep"] };
    expect(resolveToolLevel("grep", config)).toEqual({
      level: "low",
      dangerous: false,
    });
    expect(resolveToolLevel("read", config)).toEqual({
      level: "minimal",
      dangerous: false,
    });
    expect(resolveToolLevel("write", config)).toEqual({
      level: "low",
      dangerous: false,
    });
  });
});

// ============================================================================
// Integration: tool config + defaults
// ============================================================================

describe("integration: tool config with defaults", () => {
  test("mixed config — overrides and defaults coexist", () => {
    const config: ToolPermissionConfig = {
      minimal: ["read"],
      low: ["grep"],
    };
    expect(resolveToolLevel("read", config)).toEqual({
      level: "minimal",
      dangerous: false,
    });
    expect(resolveToolLevel("ls", config)).toEqual({
      level: "minimal",
      dangerous: false,
    });
    expect(resolveToolLevel("grep", config)).toEqual({
      level: "low",
      dangerous: false,
    });
    expect(resolveToolLevel("write", config)).toEqual({
      level: "low",
      dangerous: false,
    });
  });

  test("empty config preserves all defaults", () => {
    expect(resolveToolLevel("read", {})).toEqual({
      level: "minimal",
      dangerous: false,
    });
    expect(resolveToolLevel("write", {})).toEqual({
      level: "low",
      dangerous: false,
    });
    expect(resolveToolLevel("unknown", {})).toBeNull();
  });
});
