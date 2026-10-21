/**
 * Tests for getCommandName — shared helper in levels/index.ts.
 *
 * Run with: npm test
 */

import { describe, expect, test } from "vitest";
import { getCommandName } from "../../../src/core/levels";
import { isMinimalLevel } from "../../../src/core/levels/minimal";

describe("getCommandName", () => {
  test("returns empty string for empty array", () => {
    expect(getCommandName([])).toBe("");
  });

  test("returns the first token", () => {
    expect(getCommandName(["ls", "-la"])).toBe("ls");
  });

  test("extracts command from a path", () => {
    expect(getCommandName(["/usr/bin/ls", "-la"])).toBe("ls");
  });

  test("strips leading backslash escape", () => {
    expect(getCommandName(["\\ls"])).toBe("ls");
  });

  test("strips backslash on non-path command", () => {
    expect(getCommandName(["\\cat"])).toBe("cat");
    expect(getCommandName(["\\grep"])).toBe("grep");
  });

  test("handles path with backslash escape", () => {
    expect(getCommandName(["\\/usr\\/bin\\/ls"])).toBe("ls");
  });

  test("strips backslash then extracts from path", () => {
    expect(getCommandName(["\\/bin\\/cat"])).toBe("cat");
  });

  test("is case-insensitive", () => {
    expect(getCommandName(["LS"])).toBe("ls");
  });
});

// ============================================================================
// isMinimalLevel — git read-only subcommands
// ============================================================================

describe("isMinimalLevel: git read-only subcommands", () => {
  test("git branch without args is minimal", () => {
    expect(isMinimalLevel(["git", "branch"])).toBe(true);
  });

  test("git tag without args is minimal", () => {
    expect(isMinimalLevel(["git", "tag"])).toBe(true);
  });

  test("git remote without args is minimal", () => {
    expect(isMinimalLevel(["git", "remote"])).toBe(true);
  });

  test("git branch with args is NOT minimal", () => {
    expect(isMinimalLevel(["git", "branch", "new-branch"])).toBe(false);
  });

  test("git tag with args is NOT minimal", () => {
    expect(isMinimalLevel(["git", "tag", "v1.0"])).toBe(false);
  });

  test("git remote with non-flag args is NOT minimal", () => {
    expect(isMinimalLevel(["git", "remote", "add", "origin"])).toBe(false);
  });

  test("git branch with flag-only args is minimal", () => {
    expect(isMinimalLevel(["git", "branch", "-a"])).toBe(true);
  });
});
