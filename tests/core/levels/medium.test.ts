/**
 * Tests for isMediumLevel — medium permission classification.
 *
 * Run with: npm test
 */

import { describe, expect, test } from "vitest";
import { isMediumLevel } from "../../../src/core/levels/medium";

describe("isMediumLevel", () => {
  test("returns false for empty tokens", () => {
    expect(isMediumLevel([])).toBe(false);
  });

  test("git push is NOT medium (writes)", () => {
    expect(isMediumLevel(["git", "push"])).toBe(false);
  });

  test("git reset --hard is NOT medium (writes)", () => {
    expect(isMediumLevel(["git", "reset", "--hard"])).toBe(false);
  });

  test("git add is medium", () => {
    expect(isMediumLevel(["git", "add", "file.txt"])).toBe(true);
  });

  test("git commit is medium", () => {
    expect(isMediumLevel(["git", "commit", "-m", "msg"])).toBe(true);
  });

  test("git pull is medium", () => {
    expect(isMediumLevel(["git", "pull"])).toBe(true);
  });

  test("npm install is medium", () => {
    expect(isMediumLevel(["npm", "install"])).toBe(true);
  });

  test("npm run build with safe script is medium", () => {
    expect(isMediumLevel(["npm", "run", "build"])).toBe(true);
  });

  test("npm run test with safe script is medium", () => {
    expect(isMediumLevel(["npm", "run", "test"])).toBe(true);
  });

  test("npm run start is NOT medium (unsafe script)", () => {
    expect(isMediumLevel(["npm", "run", "start"])).toBe(false);
  });

  test("npm run dev is NOT medium (unsafe script)", () => {
    expect(isMediumLevel(["npm", "run", "dev"])).toBe(false);
  });

  test("npm run with no script is NOT medium", () => {
    expect(isMediumLevel(["npm", "run"])).toBe(false);
  });

  test("npm run with flag-only script is NOT medium", () => {
    expect(isMediumLevel(["npm", "run", "--help"])).toBe(false);
  });

  test("yarn add is medium", () => {
    expect(isMediumLevel(["yarn", "add", "lodash"])).toBe(true);
  });

  test("pnpm install is medium", () => {
    expect(isMediumLevel(["pnpm", "install"])).toBe(true);
  });

  test("cargo build is medium", () => {
    expect(isMediumLevel(["cargo", "build"])).toBe(true);
  });

  test("go test is medium", () => {
    expect(isMediumLevel(["go", "test"])).toBe(true);
  });

  test("pytest is medium", () => {
    expect(isMediumLevel(["pytest", "tests/"])).toBe(true);
  });

  test("unknown command is NOT medium", () => {
    expect(isMediumLevel(["unknown-command"])).toBe(false);
  });
});
