/**
 * Tests for isMinimalLevel — minimal permission classification.
 *
 * Run with: npm test
 */

import { describe, expect, test } from "vitest";
import { isMinimalLevel } from "../../../src/core/levels/minimal";

describe("isMinimalLevel", () => {
  test("returns true for empty tokens", () => {
    expect(isMinimalLevel([])).toBe(true);
  });

  test("returns true for /dev/* paths", () => {
    expect(isMinimalLevel(["/dev/null"])).toBe(true);
    expect(isMinimalLevel(["/dev/stdin"])).toBe(true);
    expect(isMinimalLevel(["/dev/stdout"])).toBe(true);
    expect(isMinimalLevel(["/dev/stderr"])).toBe(true);
    expect(isMinimalLevel(["/dev/zero"])).toBe(true);
    expect(isMinimalLevel(["/dev/random"])).toBe(true);
    expect(isMinimalLevel(["/dev/urandom"])).toBe(true);
    expect(isMinimalLevel(["/dev/fd"])).toBe(true);
    expect(isMinimalLevel(["/dev/tty"])).toBe(true);
  });

  test("returns true for single-digit file descriptors", () => {
    expect(isMinimalLevel(["0"])).toBe(true);
    expect(isMinimalLevel(["1"])).toBe(true);
    expect(isMinimalLevel(["9"])).toBe(true);
  });

  test("returns true for read-only commands", () => {
    expect(isMinimalLevel(["cat", "file.txt"])).toBe(true);
    expect(isMinimalLevel(["ls", "-la"])).toBe(true);
    expect(isMinimalLevel(["grep", "pattern", "file"])).toBe(true);
    expect(isMinimalLevel(["find", "."])).toBe(true);
    expect(isMinimalLevel(["which", "node"])).toBe(true);
  });

  test("returns true for --version / -v / -V", () => {
    expect(isMinimalLevel(["node", "--version"])).toBe(true);
    expect(isMinimalLevel(["npm", "-v"])).toBe(true);
    expect(isMinimalLevel(["python3", "-V"])).toBe(true);
  });

  test("git branch with non-flag args is NOT minimal", () => {
    expect(isMinimalLevel(["git", "branch", "new-branch"])).toBe(false);
    expect(isMinimalLevel(["git", "branch", "-d", "old"])).toBe(false);
  });

  test("git tag with non-flag args is NOT minimal", () => {
    expect(isMinimalLevel(["git", "tag", "v1.0.0"])).toBe(false);
    expect(isMinimalLevel(["git", "tag", "-a", "v1.0", "-m", "msg"])).toBe(
      false,
    );
  });

  test("git remote with non-flag args is NOT minimal", () => {
    expect(isMinimalLevel(["git", "remote", "add", "origin", "url"])).toBe(
      false,
    );
  });

  test("git branch/tag/remote with flag-only args IS minimal", () => {
    expect(isMinimalLevel(["git", "branch", "-a"])).toBe(true);
    expect(isMinimalLevel(["git", "branch", "--list"])).toBe(true);
    expect(isMinimalLevel(["git", "tag", "-l"])).toBe(true);
    expect(isMinimalLevel(["git", "remote", "-v"])).toBe(true);
  });

  test("find with -exec/-delete is NOT minimal", () => {
    expect(
      isMinimalLevel([
        "find",
        ".",
        "-name",
        "'*.txt'",
        "-exec",
        "cat",
        "{}",
        "\\;",
      ]),
    ).toBe(false);
    expect(isMinimalLevel(["find", ".", "-name", "'*.tmp'", "-delete"])).toBe(
      false,
    );
    expect(
      isMinimalLevel([
        "find",
        ".",
        "-type",
        "f",
        "-execdir",
        "mv",
        "{}",
        "{}.bak",
        "\\;",
      ]),
    ).toBe(false);
  });

  test("find without exec/delete IS minimal", () => {
    expect(isMinimalLevel(["find", ".", "-name", "'*.txt'"])).toBe(true);
    expect(isMinimalLevel(["find", ".", "-type", "f", "-name", "'*.ts'"])).toBe(
      true,
    );
  });

  test("xargs with non-read-only command is NOT minimal", () => {
    expect(isMinimalLevel(["xargs", "rm"])).toBe(false);
    expect(isMinimalLevel(["xargs", "bash", "-c", "ls"])).toBe(false);
    expect(isMinimalLevel(["xargs", "node"])).toBe(false);
  });

  test("xargs with read-only command IS minimal", () => {
    expect(isMinimalLevel(["xargs", "cat"])).toBe(true);
    expect(isMinimalLevel(["xargs", "head"])).toBe(true);
    expect(isMinimalLevel(["xargs", "grep", "pattern"])).toBe(true);
  });

  test("tee to non-null file is NOT minimal", () => {
    expect(isMinimalLevel(["tee", "file.txt"])).toBe(false);
  });

  test("tee to /dev/null IS minimal", () => {
    expect(isMinimalLevel(["tee", "/dev/null"])).toBe(true);
  });

  test("tee with no args IS minimal", () => {
    expect(isMinimalLevel(["tee"])).toBe(true);
  });

  test("package manager read-only commands are minimal", () => {
    expect(isMinimalLevel(["npm", "list"])).toBe(true);
    expect(isMinimalLevel(["npm", "info", "lodash"])).toBe(true);
    expect(isMinimalLevel(["yarn", "list"])).toBe(true);
    expect(isMinimalLevel(["pip", "list"])).toBe(true);
    expect(isMinimalLevel(["cargo", "tree"])).toBe(true);
    expect(isMinimalLevel(["go", "list", "./..."])).toBe(true);
  });

  test("package manager commands with non-read-only subcommands are NOT minimal", () => {
    expect(isMinimalLevel(["npm", "install"])).toBe(false);
    expect(isMinimalLevel(["npm", "run", "build"])).toBe(false);
    expect(isMinimalLevel(["yarn", "add", "lodash"])).toBe(false);
    expect(isMinimalLevel(["pip", "install", "requests"])).toBe(false);
  });
});
