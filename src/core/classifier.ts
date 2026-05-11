/**
 * Command classification - parsing, level detection, dangerous command detection
 */

import { parse } from "shell-quote";
import { applyPrefixMappings, checkOverrides, getCachedConfig } from "./config";
import {
  ALL_REDIRECTION_OPS,
  COMMAND_SEPARATORS,
  OUTPUT_REDIRECTION_OPS,
  SAFE_REDIRECTION_TARGETS,
  SHELL_EXECUTION_COMMANDS,
  SHELL_TRICK_PATTERNS,
} from "./constants";
import {
  getCommandName,
  isHighLevel,
  isMediumLevel,
  isMinimalLevel,
} from "./levels/index";
import type { Classification, PermissionLevel } from "./types";
import { LEVEL_INDEX } from "./types";

// ============================================================================
// COMMAND PARSING
// ============================================================================

interface ParsedCommand {
  segments: string[][]; // Commands split by operators
  operators: string[]; // |, &&, ||, ;
  raw: string;
  hasShellTricks?: boolean;
  /** Output redirections to non-special files (>, >>) */
  writesFiles?: boolean;
}

function hasDangerousExpansion(command: string): boolean {
  const braceExpansions = command.match(/\$\{[^}]+\}/g) || [];
  for (const expansion of braceExpansions) {
    if (/\$\(|\`/.test(expansion)) {
      return true;
    }
  }
  return false;
}

function detectShellTricks(command: string): boolean {
  if (SHELL_TRICK_PATTERNS.some((pattern) => pattern.test(command))) {
    return true;
  }
  if (hasDangerousExpansion(command)) {
    return true;
  }
  return false;
}

function parseCommand(command: string): ParsedCommand {
  const hasShellTricks = detectShellTricks(command);

  let tokens: ReturnType<typeof parse>;
  try {
    tokens = parse(command);
  } catch {
    return {
      segments: [],
      operators: [],
      raw: command,
      hasShellTricks: true,
    };
  }

  const segments: string[][] = [];
  const operators: string[] = [];
  let currentSegment: string[] = [];
  let foundCommandSubstitution = false;
  let writesFiles = false;

  let pendingOutputRedirect = false;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (pendingOutputRedirect) {
      pendingOutputRedirect = false;
      if (typeof token === "string") {
        if (
          !SAFE_REDIRECTION_TARGETS.has(token) &&
          !token.startsWith("/dev/fd/")
        ) {
          writesFiles = true;
        }
      }
      continue;
    }

    if (typeof token === "string") {
      currentSegment.push(token);
    } else if (token && typeof token === "object") {
      if ("op" in token) {
        const op = token.op as string;
        if (ALL_REDIRECTION_OPS.has(op)) {
          if (OUTPUT_REDIRECTION_OPS.has(op)) {
            pendingOutputRedirect = true;
          } else {
            if (op === ">&" || op === "<&") {
              const nextToken = tokens[i + 1];
              if (typeof nextToken === "string" && /^\d+$/.test(nextToken)) {
                i++;
              } else {
                pendingOutputRedirect = true;
              }
            }
          }
        } else {
          if (COMMAND_SEPARATORS.has(op)) {
            if (currentSegment.length > 0) {
              segments.push(currentSegment);
              currentSegment = [];
            }
            operators.push(op);
          }
        }
      } else if ("comment" in token) {
        // Comment - ignore
      } else {
        foundCommandSubstitution = true;
      }
    }
  }

  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  return {
    segments,
    operators,
    raw: command,
    hasShellTricks: hasShellTricks || foundCommandSubstitution,
    writesFiles,
  };
}

// ============================================================================
// DANGEROUS COMMAND DETECTION
// ============================================================================

function isDangerousCommand(tokens: string[]): boolean {
  if (tokens.length === 0) return false;

  const cmd = getCommandName(tokens);
  const args = tokens.slice(1);
  const argsStr = args.join(" ");

  if (cmd === "sudo") return true;

  if (cmd === "rm") {
    let hasRecursive = false;
    let hasForce = false;

    for (const arg of args) {
      if (arg === "--recursive") hasRecursive = true;
      if (arg === "--force") hasForce = true;
      if (arg.startsWith("-") && !arg.startsWith("--")) {
        if (arg.includes("r") || arg.includes("R")) hasRecursive = true;
        if (arg.includes("f")) hasForce = true;
      }
    }

    if (hasRecursive && hasForce) return true;
  }

  if (cmd === "chmod") {
    if (argsStr.includes("777") || argsStr.includes("a+rwx")) return true;
  }

  if (cmd === "dd") {
    if (argsStr.match(/of=\/dev\//)) return true;
  }

  if (["fdisk", "parted", "format"].includes(cmd)) return true;
  if (cmd.startsWith("mkfs")) return true;

  if (["shutdown", "reboot", "halt", "poweroff", "init"].includes(cmd))
    return true;

  if (tokens.join("").includes(":(){ :|:& };:")) return true;

  return false;
}

// ============================================================================
// CLASSIFY SEGMENT
// ============================================================================

function classifySegment(tokens: string[]): Classification {
  if (tokens.length === 0) {
    return { level: "minimal", dangerous: false };
  }

  const cmd = getCommandName(tokens);

  if (SHELL_EXECUTION_COMMANDS.has(cmd)) {
    return { level: "high", dangerous: false };
  }

  if (isDangerousCommand(tokens)) {
    return { level: "high", dangerous: true };
  }

  if (isMinimalLevel(tokens)) {
    return { level: "minimal", dangerous: false };
  }

  if (isMediumLevel(tokens)) {
    return { level: "medium", dangerous: false };
  }

  if (isHighLevel(tokens)) {
    return { level: "high", dangerous: false };
  }

  return { level: "high", dangerous: false };
}

// ============================================================================
// PUBLIC CLASSIFY COMMAND
// ============================================================================

export function classifyCommand(command: string, config?: any): Classification {
  const effectiveConfig = config ?? getCachedConfig();

  const normalizedCommand = applyPrefixMappings(
    command,
    effectiveConfig.prefixMappings,
  );

  const parsed = parseCommand(normalizedCommand);

  if (parsed.hasShellTricks) {
    return { level: "high", dangerous: false };
  }

  const override = checkOverrides(normalizedCommand, effectiveConfig.overrides);
  if (override) {
    return override;
  }

  let maxLevel: PermissionLevel = "minimal";
  let dangerous = false;

  if (parsed.writesFiles) {
    maxLevel = "low";
  }

  for (let i = 0; i < parsed.segments.length; i++) {
    const segment = parsed.segments[i];
    const segmentClass = classifySegment(segment);

    if (segmentClass.dangerous) {
      dangerous = true;
    }

    if (LEVEL_INDEX[segmentClass.level] > LEVEL_INDEX[maxLevel]) {
      maxLevel = segmentClass.level;
    }

    if (i < parsed.segments.length - 1 && parsed.operators[i] === "|") {
      const nextCmd = getCommandName(parsed.segments[i + 1]);
      if (
        [
          "bash",
          "sh",
          "zsh",
          "node",
          "python",
          "python3",
          "ruby",
          "perl",
        ].includes(nextCmd)
      ) {
        maxLevel = "high";
      }
    }
  }

  return { level: maxLevel, dangerous };
}
