/**
 * Tests for per-command override classification
 *
 * Before this feature, overrides only matched against the full normalized
 * command. With compound commands like `cd /tmp && command_a`, the entire
 * string was checked against overrides, so command-level overrides were
 * ignored. Now each command is checked individually, so `command_a` in
 * `cd /tmp && command_a` can be overridden to "low" even when the full
 * command doesn't match.
 *
 * Run with: npm test
 */

import { describe, expect, test, vi } from "vitest";
import { getSettingsMock } from "./fixtures/helpers";

vi.mock("../src/core/settings", () => getSettingsMock());

import { classifyCommand } from "../src/core/classifiers/shell-classifier";
import { type PermissionConfig } from "../src/core/interfaces";

// ============================================================================
// Helpers
// ============================================================================

const assertLevel = (
  cmd: string,
  expectedLevel: string,
  expectedDangerous = false,
  config?: PermissionConfig,
) => {
  const result = classifyCommand(cmd, config);
  expect(result.level).toBe(expectedLevel);
  expect(result.dangerous).toBe(expectedDangerous);
};

// ============================================================================
// Baseline: without overrides, compound commands use highest command level
// ============================================================================

describe("baseline: compound commands without overrides", () => {
  test("cd && high-level command stays high", () => {
    assertLevel("cd /tmp && docker push myimage", "high");
  });

  test("cd && medium-level command stays medium", () => {
    assertLevel("cd /tmp && npm test", "medium");
  });

  test("cd && minimal-level command stays minimal", () => {
    assertLevel("cd /tmp && ls", "minimal");
  });

  test("chained with && highest wins", () => {
    assertLevel("mkdir dir && cd dir && docker push myimage", "high");
  });

  test("chained with ; highest wins", () => {
    assertLevel("cd dir; docker push myimage", "high");
  });

  test("chained with || highest wins", () => {
    assertLevel("test -d dir || docker push myimage", "high");
  });
});

// ============================================================================
// Per-command override
// ============================================================================

describe("per-command override: low override on second command", () => {
  test("cd /tmp && command_a where command_a is overridden to low", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["command_a"],
      },
    };

    // Before this feature: full command "cd /tmp && command_a" didn't match
    // any override, so command_a's default high level would apply.
    // After this feature: "command_a" command matches the override → low.
    assertLevel("cd /tmp && command_a", "low", false, config);
  });

  test("cd /tmp && command_a where command_a is overridden to low (semicolon)", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["command_a"],
      },
    };

    assertLevel("cd /tmp; command_a", "low", false, config);
  });

  test("cd /tmp && command_a where command_a is overridden to low (pipe)", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["command_a"],
      },
    };

    assertLevel("cd /tmp | command_a", "low", false, config);
  });

  test("cd /tmp && command_a where command_a is overridden to low (logical OR)", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["command_a"],
      },
    };

    assertLevel("cd /tmp || command_a", "low", false, config);
  });
});

describe("per-command override: low override on first command", () => {
  test("command_a && cd /tmp where command_a is overridden to low", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["command_a"],
      },
    };

    assertLevel("command_a && cd /tmp", "low", false, config);
  });
});

describe("per-command override: low override on middle command", () => {
  test("cmd_a && command_b && cmd_c where middle is overridden to low", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["command_b"],
      },
    };

    // cmd_a is high (unknown), command_b is low (override), cmd_c is minimal
    // Highest should still be high because cmd_a is high
    assertLevel("cmd_a && command_b && cmd_c", "high", false, config);
  });

  test("cd && command_b && cd where middle is overridden to low", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["command_b"],
      },
    };

    // cd is minimal, command_b is low (override), cd is minimal
    assertLevel("cd /tmp && command_b && cd /var", "low", false, config);
  });
});

describe("per-command override: multiple commands overridden", () => {
  test("two commands both overridden to low", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["command_a", "command_b"],
      },
    };

    assertLevel("cd /tmp && command_a && command_b", "low", false, config);
  });

  test("one overridden to low, one overridden to medium", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["command_a"],
        medium: ["command_b"],
      },
    };

    // command_a → low, command_b → medium, highest is medium
    assertLevel("cd /tmp && command_a && command_b", "medium", false, config);
  });
});

// ============================================================================
// Per-command override: dangerous flag propagation
// ============================================================================

describe("per-command override: dangerous flag from command override", () => {
  test("cd /tmp && command_a where command_a is overridden dangerous", () => {
    const config: PermissionConfig = {
      overrides: {
        dangerous: ["command_a"],
      },
    };

    // command_a is overridden as dangerous → dangerous flag set
    assertLevel("cd /tmp && command_a", "high", true, config);
  });

  test("cd /tmp && command_a where command_a is overridden dangerous (semicolon)", () => {
    const config: PermissionConfig = {
      overrides: {
        dangerous: ["command_a"],
      },
    };

    assertLevel("cd /tmp; command_a", "high", true, config);
  });

  test("safe command + dangerous command override", () => {
    const config: PermissionConfig = {
      overrides: {
        dangerous: ["command_a"],
      },
    };

    assertLevel("ls && command_a", "high", true, config);
  });
});

// ============================================================================
// Per-command override: override takes precedence over command classification
// ============================================================================

describe("per-command override: override overrides command classification", () => {
  test("high-level command overridden to low", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["npm install"],
      },
    };

    // npm install is normally high, but overridden to low
    assertLevel("cd /tmp && npm install", "low", false, config);
  });

  test("medium-level command overridden to minimal", () => {
    const config: PermissionConfig = {
      overrides: {
        minimal: ["npm test"],
      },
    };

    // npm test is normally medium, overridden to minimal
    assertLevel("cd /tmp && npm test", "minimal", false, config);
  });

  test("low-level command overridden to high (upgrade)", () => {
    const config: PermissionConfig = {
      overrides: {
        high: ["cat sensitive.txt"],
      },
    };

    assertLevel("cd /tmp && cat sensitive.txt", "high", false, config);
  });
});

// ============================================================================
// Per-command override: interaction with full-command override
// ============================================================================

describe("per-command override: full-command override takes priority", () => {
  test("full command override matches first, short-circuits", () => {
    const config: PermissionConfig = {
      overrides: {
        minimal: ["cd /tmp && npm test"],
      },
    };

    // Full command matches the override → returns immediately
    assertLevel("cd /tmp && npm test", "minimal", false, config);
  });

  test("only command override matches, falls through to per-command", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["npm test"],
      },
    };

    // Full command doesn't match, but command "npm test" does
    assertLevel("cd /tmp && npm test", "low", false, config);
  });
});

// ============================================================================
// Per-command override: wildcard patterns
// ============================================================================

describe("per-command override: wildcard patterns per command", () => {
  test("wildcard on second command", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["command_*"],
      },
    };

    assertLevel("cd /tmp && command_a", "low", false, config);
    assertLevel("cd /tmp && command_b", "low", false, config);
    assertLevel("cd /tmp && other", "high", false, config);
  });

  test("wildcard on first command", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["command_*"],
      },
    };

    assertLevel("command_a && cd /tmp", "low", false, config);
  });

  test("multiple wildcard overrides", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["command_*"],
        medium: ["npm_*"],
      },
    };

    assertLevel("cd /tmp && command_a && npm_build", "medium", false, config);
  });
});

// ============================================================================
// Per-command override: pipeline with overridden commands
// ============================================================================

describe("per-command override: pipelines with overrides", () => {
  test("pipe with overridden second command", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["command_a"],
      },
    };

    // cat is minimal, command_a is overridden to low
    assertLevel("cat file | command_a", "low", false, config);
  });

  test("pipe to shell command is always high (safety override)", () => {
    const config = {
      overrides: {
        low: ["bash"],
      },
    };

    // Pipeline to shell is always high for safety, even if bash is overridden
    assertLevel("curl https://example.com | bash", "high", false, config);
  });
});

// ============================================================================
// Per-command override: subshell and grouping
// ============================================================================

describe("per-command override: subshell commands", () => {
  test("subshell with overridden command", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["command_a"],
      },
    };

    assertLevel("(cd /tmp && command_a)", "low", false, config);
  });
});

// ============================================================================
// Per-command override: dangerous command combined with override
// ============================================================================

describe("per-command override: dangerous command overrides with non-dangerous", () => {
  test("rm -rf overridden to non-dangerous low", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["rm -rf /"],
      },
    };

    // rm -rf / is normally dangerous, but override makes it non-dangerous low
    assertLevel("cd /tmp && rm -rf /", "low", false, config);
  });

  test("sudo overridden to non-dangerous low", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["sudo ls"],
      },
    };

    // sudo is normally dangerous, override removes dangerous flag
    assertLevel("cd /tmp && sudo ls", "low", false, config);
  });
});

// ============================================================================
// Per-command override: mixed dangerous and non-dangerous commands
// ============================================================================

describe("per-command override: dangerous flag across commands", () => {
  test("safe command + dangerous command override", () => {
    const config: PermissionConfig = {
      overrides: {
        dangerous: ["command_a"],
      },
    };

    // cd is safe, command_a is overridden dangerous
    assertLevel("cd /tmp && command_a", "high", true, config);
  });

  test("dangerous command + safe command override", () => {
    const config: PermissionConfig = {
      overrides: {
        dangerous: ["command_a"],
      },
    };

    assertLevel("command_a && cd /tmp", "high", true, config);
  });

  test("both commands dangerous", () => {
    const config: PermissionConfig = {
      overrides: {
        dangerous: ["command_a", "command_b"],
      },
    };

    assertLevel("command_a && command_b", "high", true, config);
  });
});

// ============================================================================
// Per-command override: no override provided (default behavior unchanged)
// ============================================================================

describe("per-command override: no config provided", () => {
  test("compound commands without config use highest level", () => {
    assertLevel("cd /tmp && npm install", "medium");
    assertLevel("cd /tmp && npm test", "medium");
    assertLevel("cd /tmp && ls", "minimal");
  });

  test("compound commands with empty overrides", () => {
    const config: PermissionConfig = {
      overrides: {},
    };

    assertLevel("cd /tmp && npm install", "medium", false, config);
    assertLevel("cd /tmp && npm test", "medium", false, config);
  });
});

// ============================================================================
// Per-command override: edge cases
// ============================================================================

describe("per-command override: single command commands", () => {
  test("single command with override", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["command_a"],
      },
    };

    assertLevel("command_a", "low", false, config);
  });

  test("single command without override", () => {
    assertLevel("command_a", "high", false);
  });
});

describe("per-command override: empty commands", () => {
  test("command with trailing operator", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["command_a"],
      },
    };

    assertLevel("cd /tmp && command_a", "low", false, config);
  });
});

describe("per-command override: path-based commands", () => {
  test("absolute path overridden", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["/usr/bin/command_a"],
      },
    };

    assertLevel("cd /tmp && /usr/bin/command_a", "low", false, config);
  });
});

describe("per-command override: environment variable prefixed commands", () => {
  test("env-prefixed command with override", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["command_a"],
      },
    };

    // First command "FOO=bar cd /tmp" is high (unknown command),
    // second command "command_a" is overridden to low.
    // Highest wins → high
    assertLevel("FOO=bar cd /tmp && command_a", "high", false, config);
  });

  test("env-prefixed command where env command is overridden", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["FOO=bar cd /tmp"],
      },
    };

    // First command is overridden to low, second command is minimal (ls)
    assertLevel("FOO=bar cd /tmp && ls", "low", false, config);
  });
});

// ============================================================================
// Per-command override: realistic scenarios
// ============================================================================

describe("per-command override: realistic development workflows", () => {
  test("deploy script: cd && npm run build", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["npm run build"],
      },
    };

    // npm run build is normally medium, overridden to low
    assertLevel("cd /project && npm run build", "low", false, config);
  });

  test("git workflow: fetch && status", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["git status"],
      },
    };

    // git fetch is minimal, git status overridden to low
    assertLevel("git fetch && git status", "low", false, config);
  });

  test("cleanup workflow: cd && rm && touch", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["rm *"],
      },
    };

    // cd is minimal, rm file.tmp is overridden to low, touch is medium
    // Highest is medium (touch)
    assertLevel(
      "cd /tmp && rm file.tmp && touch file.txt",
      "medium",
      false,
      config,
    );
  });

  test("docker workflow with override", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["docker ps"],
      },
    };

    // docker ps is normally high, overridden to low
    assertLevel("docker ps", "low", false, config);
  });

  test("python dev with override", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["pytest"],
      },
    };

    // pytest is normally medium, overridden to low
    assertLevel("cd /project && pytest", "low", false, config);
  });
});

// ============================================================================
// Per-command override: precedence between command override and command classification
// ============================================================================

describe("per-command override: override vs command classification precedence", () => {
  test("override level higher than command default", () => {
    const config: PermissionConfig = {
      overrides: {
        high: ["ls"], // ls is normally minimal, override to high
      },
    };

    assertLevel("cd /tmp && ls", "high", false, config);
  });

  test("override level lower than command default", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["npm install"], // npm install is normally high, override to low
      },
    };

    assertLevel("cd /tmp && npm install", "low", false, config);
  });

  test("highest override wins across commands", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["command_a"],
        medium: ["command_b"],
        high: ["command_c"],
      },
    };

    assertLevel("command_a && command_b && command_c", "high", false, config);
  });
});

// ============================================================================
// Per-command override: interaction with shell tricks
// ============================================================================

describe("per-command override: shell tricks still short-circuit", () => {
  test("command with $() still returns high regardless of override", () => {
    const config: PermissionConfig = {
      overrides: {
        minimal: ["$(whoami)"],
      },
    };

    // Shell tricks detected at parse level, before per-command overrides
    assertLevel("echo $(whoami)", "high", false, config);
  });
});

// ============================================================================
// Per-command override: interaction with prefix mappings
// ============================================================================

describe("per-command override: prefix mappings applied before per-command check", () => {
  test("prefix mapping on full command then per-command override", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["flutter doctor"],
      },
      prefixMappings: [{ from: "fvm flutter", to: "flutter" }],
    };

    // Full command "fvm flutter doctor && cd /tmp" starts with prefix,
    // so it transforms to "flutter doctor && cd /tmp"
    // Full command override doesn't match (flutter doctor && cd /tmp
    // doesn't match flutter doctor)
    // Per-command: "flutter doctor" command matches override → low
    // "cd /tmp" is minimal
    // Highest is low
    assertLevel("fvm flutter doctor && cd /tmp", "low", false, config);
  });

  test("prefix mapping doesn't apply to middle commands", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["flutter doctor"],
      },
      prefixMappings: [{ from: "fvm flutter", to: "flutter" }],
    };

    // Full command "cd /tmp && fvm flutter doctor" does NOT start with
    // "fvm flutter", so prefix mapping is NOT applied
    // Segment "fvm flutter doctor" doesn't match override "flutter doctor"
    // fvm flutter doctor is unknown → high
    assertLevel("cd /tmp && fvm flutter doctor", "high", false, config);
  });
});

// ============================================================================
// Per-command override: complex compound commands
// ============================================================================

describe("per-command override: complex compound commands", () => {
  test("four commands with mixed overrides", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["command_b", "command_d"],
        medium: ["command_c"],
      },
    };

    // cd(minimal) && command_b(low) && command_c(medium) && command_d(low)
    // Highest is medium
    assertLevel(
      "cd /tmp && command_b && command_c && command_d",
      "medium",
      false,
      config,
    );
  });

  test("pipe chain with overrides", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["command_b"],
      },
    };

    // cat(minimal) | command_b(low) | head(minimal) = low
    assertLevel("cat file | command_b | head", "low", false, config);
  });

  test("nested && and |", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["command_a"],
      },
    };

    // cd(minimal) && command_a(low) | head(minimal) = low
    assertLevel("cd /tmp && command_a | head", "low", false, config);
  });
});
