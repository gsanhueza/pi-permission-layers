/**
 * Tests for isHighLevel — high permission classification.
 *
 * Run with: npm test
 */

import { describe, expect, test } from "vitest";
import { isHighLevel } from "../../../src/core/levels/high";

describe("isHighLevel", () => {
  test("returns false for empty tokens", () => {
    expect(isHighLevel([])).toBe(false);
  });

  test("git push is high", () => {
    expect(isHighLevel(["git", "push"])).toBe(true);
    expect(isHighLevel(["git", "push", "origin", "main"])).toBe(true);
  });

  test("git reset --hard is high", () => {
    expect(isHighLevel(["git", "reset", "--hard"])).toBe(true);
    expect(isHighLevel(["git", "reset", "--hard", "HEAD~1"])).toBe(true);
  });

  test("git reset without --hard is NOT high", () => {
    expect(isHighLevel(["git", "reset", "HEAD~1"])).toBe(false);
    expect(isHighLevel(["git", "reset", "soft", "HEAD"])).toBe(false);
  });

  test("curl alone is high (network tool)", () => {
    expect(isHighLevel(["curl"])).toBe(true);
    expect(isHighLevel(["curl", "--help"])).toBe(true);
  });

  test("curl with URL is high", () => {
    expect(isHighLevel(["curl", "https://example.com"])).toBe(true);
    expect(isHighLevel(["curl", "http://example.com"])).toBe(true);
  });

  test("wget is high", () => {
    expect(isHighLevel(["wget", "https://example.com"])).toBe(true);
    expect(isHighLevel(["wget", "-O", "file", "https://example.com"])).toBe(
      true,
    );
  });

  test("bash/sh/zsh with URL is high", () => {
    expect(isHighLevel(["bash", "-c", "curl https://x.com"])).toBe(true);
    expect(isHighLevel(["sh", "-c", "wget https://x.com"])).toBe(true);
    expect(isHighLevel(["zsh", "-c", "http://x.com"])).toBe(true);
  });

  test("bash/sh/zsh without URL is NOT high", () => {
    expect(isHighLevel(["bash"])).toBe(false);
    expect(isHighLevel(["bash", "-i"])).toBe(false);
    expect(isHighLevel(["sh", "script.sh"])).toBe(false);
    expect(isHighLevel(["zsh", "-l"])).toBe(false);
  });

  test("docker push/login/logout is high", () => {
    expect(isHighLevel(["docker", "push", "myimage"])).toBe(true);
    expect(isHighLevel(["docker", "login"])).toBe(true);
    expect(isHighLevel(["docker", "logout"])).toBe(true);
  });

  test("docker build/run is NOT high (not in list)", () => {
    expect(isHighLevel(["docker", "build", "."])).toBe(false);
    expect(isHighLevel(["docker", "run", "nginx"])).toBe(false);
    expect(isHighLevel(["docker", "ps"])).toBe(false);
  });

  test("deployment tools are high", () => {
    expect(isHighLevel(["kubectl", "apply", "-f", "deploy.yaml"])).toBe(true);
    expect(isHighLevel(["helm", "install", "myrelease"])).toBe(true);
    expect(isHighLevel(["terraform", "apply"])).toBe(true);
    expect(isHighLevel(["pulumi", "up"])).toBe(true);
    expect(isHighLevel(["ansible"])).toBe(true);
  });

  test("network tools are high", () => {
    expect(isHighLevel(["ssh", "user@host"])).toBe(true);
    expect(isHighLevel(["scp", "file", "user@host:/path"])).toBe(true);
    expect(isHighLevel(["rsync", "-avz", ".", "user@host:/path"])).toBe(true);
  });

  test("unknown command is NOT high", () => {
    expect(isHighLevel(["unknown-cmd"])).toBe(false);
    expect(isHighLevel(["my-custom-tool"])).toBe(false);
  });
});
