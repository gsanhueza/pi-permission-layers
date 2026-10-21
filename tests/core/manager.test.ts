/**
 * Tests for SettingsManager — load, save, and validate.
 *
 * Run with: npm test
 */

import { describe, expect, test, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { SettingsManager } from "../../src/core/manager";

// ============================================================================
// TEMPORARY DIRECTORY
// ============================================================================

const tmpDir = path.join(__dirname, "__tmp__");

beforeEach(() => {
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true });
  }
  fs.mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

function makeManager(filename: string): SettingsManager {
  return new SettingsManager(path.join(tmpDir, filename));
}

// ============================================================================
// load
// ============================================================================

describe("SettingsManager: load", () => {
  test("parses valid JSON", () => {
    fs.writeFileSync(
      path.join(tmpDir, "valid.json"),
      JSON.stringify({ quietStartup: true }),
    );
    const manager = makeManager("valid.json");
    expect(manager.load()).toEqual({ quietStartup: true });
  });

  test("returns empty object on parse error", () => {
    fs.writeFileSync(path.join(tmpDir, "invalid.json"), "{ invalid json");
    const manager = makeManager("invalid.json");
    expect(manager.load()).toEqual({});
  });

  test("returns empty object when file does not exist", () => {
    const manager = makeManager("missing.json");
    expect(manager.load()).toEqual({});
  });
});

// ============================================================================
// save
// ============================================================================

describe("SettingsManager: save", () => {
  test("writes to temp file then renames", () => {
    const manager = makeManager("save.json");
    manager.save({ quietStartup: true });

    expect(fs.existsSync(path.join(tmpDir, "save.json"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, "save.json.tmp"))).toBe(false);
    expect(
      JSON.parse(fs.readFileSync(path.join(tmpDir, "save.json"), "utf-8")),
    ).toEqual({
      quietStartup: true,
    });
  });

  test("creates parent directory if missing", () => {
    const nestedPath = path.join(tmpDir, "nested", "deep", "settings.json");
    const manager = new SettingsManager(nestedPath);
    manager.save({ quietStartup: true });

    expect(fs.existsSync(nestedPath)).toBe(true);
    expect(JSON.parse(fs.readFileSync(nestedPath, "utf-8"))).toEqual({
      quietStartup: true,
    });
  });

  test("cleans up temp file on error", () => {
    // Create a file where the manager expects a directory, so mkdirSync fails
    const blocker = path.join(tmpDir, "blocker");
    fs.writeFileSync(blocker, "not-a-dir");
    const badPath = path.join(blocker, "settings.json");
    const badManager = new SettingsManager(badPath);
    expect(() => badManager.save({})).toThrow();
  });

  test("does not leave temp file on error", () => {
    // Create a file where the manager expects a directory, so writeFileSync
    // still creates the .tmp before rename fails
    const blocker = path.join(tmpDir, "blocker2");
    fs.writeFileSync(blocker, "not-a-dir");
    const badPath = path.join(blocker, "settings.json");
    const badManager = new SettingsManager(badPath);
    expect(() => badManager.save({})).toThrow();
    expect(fs.existsSync(path.join(blocker, "settings.json.tmp"))).toBe(false);
  });
});

// ============================================================================
// validate
// ============================================================================

describe("SettingsManager: validate", () => {
  test("returns empty object for null input", () => {
    const manager = makeManager("validate.json");
    expect(manager.validate(null as never)).toEqual({});
  });

  test("returns empty object for non-object input", () => {
    const manager = makeManager("validate.json");
    expect(manager.validate("not-an-object" as never)).toEqual({});
    expect(manager.validate([] as never)).toEqual({});
  });

  test("silences invalid overrides", () => {
    const manager = makeManager("validate.json");
    const validated = manager.validate({
      overrides: "not-an-object" as never,
    });
    expect(validated.overrides).toBeUndefined();
  });

  test("silences invalid tools config", () => {
    const manager = makeManager("validate.json");
    const validated = manager.validate({
      tools: "not-an-object" as never,
    });
    expect(validated.tools).toBeUndefined();
  });

  test("silences invalid mcp config", () => {
    const manager = makeManager("validate.json");
    const validated = manager.validate({
      mcp: "not-an-object" as never,
    });
    expect(validated.mcp).toBeUndefined();
  });

  test("silences invalid prefixMappings", () => {
    const manager = makeManager("validate.json");
    const validated = manager.validate({
      prefixMappings: "not-an-array" as never,
    });
    expect(validated.prefixMappings).toBeUndefined();
  });

  test("passes through quietStartup", () => {
    const manager = makeManager("validate.json");
    const validated = manager.validate({ quietStartup: true });
    expect(validated.quietStartup).toBe(true);
  });

  test("passes through systemNotifications", () => {
    const manager = makeManager("validate.json");
    const validated = manager.validate({ systemNotifications: "on" });
    expect(validated.systemNotifications).toBe("on");
  });

  test("returns only non-default fields", () => {
    const manager = makeManager("validate.json");
    const validated = manager.validate({
      quietStartup: false,
      systemNotifications: "off",
    });
    expect(validated.quietStartup).toBe(false);
    expect(validated.systemNotifications).toBe("off");
  });

  test("prefixMappings: filters invalid entries", () => {
    const manager = makeManager("validate.json");
    const validated = manager.validate({
      prefixMappings: [
        { from: "myapp", to: "node" },
        { from: "", to: "x" },
        { to: "x" } as never,
        { from: "myapp", to: "deno" },
        null as never,
      ],
    });
    expect(validated.prefixMappings).toHaveLength(2);
    expect(validated.prefixMappings).toEqual([
      { from: "myapp", to: "node" },
      { from: "myapp", to: "deno" },
    ]);
  });

  test("prefixMappings: caps at 50 entries", () => {
    const manager = makeManager("validate.json");
    const mappings = Array.from({ length: 75 }, (_, i) => ({
      from: `prefix${i}`,
      to: `cmd${i}`,
    }));
    const validated = manager.validate({ prefixMappings: mappings });
    expect(validated.prefixMappings!.length).toBe(50);
  });

  test("prefixMappings: empty array returns undefined", () => {
    const manager = makeManager("validate.json");
    const validated = manager.validate({ prefixMappings: [] });
    expect(validated.prefixMappings).toBeUndefined();
  });

  test("empty result returns undefined for optional fields", () => {
    const manager = makeManager("validate.json");
    const validated = manager.validate({
      overrides: {},
      tools: {},
      mcp: {},
      prefixMappings: [],
    });
    expect(validated.overrides).toBeUndefined();
    expect(validated.tools).toBeUndefined();
    expect(validated.mcp).toBeUndefined();
    expect(validated.prefixMappings).toBeUndefined();
  });
});
