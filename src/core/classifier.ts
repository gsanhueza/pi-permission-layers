/**
 * Command classification - parsing, level detection, dangerous command detection
 */

import { parse } from "shell-quote";
import {
  applyPrefixMappings,
  checkOverrides,
  getCachedConfig,
} from "./config.js";
import type { Classification, PermissionLevel } from "./types.js";
import { LEVEL_INDEX } from "./types.js";

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

// Shell execution commands that can run arbitrary code
const SHELL_EXECUTION_COMMANDS = new Set([
  "eval",
  "exec",
  "source",
  ".", // shell builtins
  "env", // can execute commands: env rm -rf /
  "command", // bypasses aliases, can execute arbitrary commands
  "builtin", // uses shell builtins directly
  // Wrapper commands that can execute arbitrary commands
  "time",
  "nice",
  "nohup",
  "timeout",
  "watch",
  "strace",
  // Note: xargs is handled in CONDITIONAL_WRITE_COMMANDS with smart logic
]);

// Patterns that indicate command substitution or shell tricks in raw command
const SHELL_TRICK_PATTERNS = [
  /\$\((?!\()[^)]+\)/, // $(command) - command substitution (exclude $(( for arithmetic)
  /`[^`]+`/, // `command` - backtick substitution
  /<\([^)]+\)/, // <(command) - process substitution (input)
  />\([^)]+\)/, // >(command) - process substitution (output)
];

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

function hasArithmeticExpansion(command: string): boolean {
  return /\$\(\(/.test(command);
}

// Output redirection operators that write to files
const OUTPUT_REDIRECTION_OPS = new Set([">", ">>", ">|", "&>", "&>>"]);

// Safe redirection targets (not actual file writes)
const SAFE_REDIRECTION_TARGETS = new Set([
  "/dev/null",
  "/dev/stdout",
  "/dev/stderr",
  "/dev/fd/1",
  "/dev/fd/2",
]);

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

  const REDIRECTION_OPS = new Set([
    ">",
    "<",
    ">>",
    ">&",
    "<&",
    ">|",
    "<>",
    "&>",
    "&>>",
  ]);
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
        if (REDIRECTION_OPS.has(op)) {
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
          const COMMAND_SEPARATORS = new Set(["|", "&&", "||", ";", "&"]);
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

function getCommandName(tokens: string[]): string {
  if (tokens.length === 0) return "";

  let cmd = tokens[0];

  if (cmd.includes("/")) {
    cmd = cmd.split("/").pop() || cmd;
  }

  if (cmd.startsWith("\\")) {
    cmd = cmd.slice(1);
  }

  return cmd.toLowerCase();
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
// LEVEL CLASSIFICATION - MINIMAL
// ============================================================================

const REDIRECTION_TARGETS = new Set([
  "/dev/null",
  "/dev/stdin",
  "/dev/stdout",
  "/dev/stderr",
  "/dev/zero",
  "/dev/full",
  "/dev/random",
  "/dev/urandom",
  "/dev/fd",
  "/dev/tty",
  "/dev/ptmx",
]);

const FD_NUMBERS = new Set(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);

const MINIMAL_COMMANDS = new Set([
  "cat",
  "less",
  "more",
  "head",
  "tail",
  "bat",
  "tac",
  "ls",
  "tree",
  "pwd",
  "dir",
  "vdir",
  "cd",
  "pushd",
  "popd",
  "dirs",
  "grep",
  "egrep",
  "fgrep",
  "rg",
  "ag",
  "ack",
  "fd",
  "locate",
  "which",
  "whereis",
  "echo",
  "printf",
  "whoami",
  "id",
  "date",
  "cal",
  "uname",
  "hostname",
  "uptime",
  "type",
  "file",
  "stat",
  "wc",
  "du",
  "df",
  "free",
  "ps",
  "top",
  "htop",
  "pgrep",
  "sleep",
  "man",
  "help",
  "info",
  "sort",
  "uniq",
  "cut",
  "awk",
  "sed",
  "tr",
  "column",
  "paste",
  "join",
  "comm",
  "diff",
  "cmp",
  "patch",
  "test",
  "[",
  "[[",
  "true",
  "false",
]);

const CONDITIONAL_WRITE_COMMANDS: Record<
  string,
  (tokens: string[]) => boolean
> = {
  find: (tokens) => {
    const dangerousFlags = ["-exec", "-execdir", "-ok", "-okdir", "-delete"];
    return tokens.some((t) => dangerousFlags.includes(t.toLowerCase()));
  },
  xargs: (tokens) => {
    const xargsCmd = extractXargsCommand(tokens);
    if (xargsCmd === null) return false;
    if (MINIMAL_COMMANDS.has(xargsCmd)) return false;
    return true;
  },
  tee: (tokens) => {
    const args = tokens.slice(1).filter((t) => !t.startsWith("-"));
    if (args.length === 0) return false;
    return !args.every((a) => a === "/dev/null");
  },
};

function extractXargsCommand(tokens: string[]): string | null {
  const args = tokens.slice(1);
  const OPTIONS_WITH_ARG = new Set([
    "-I",
    "-d",
    "-E",
    "-L",
    "-n",
    "-P",
    "-s",
    "-a",
  ]);

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === "--") {
      i++;
      break;
    }

    if (!arg.startsWith("-")) {
      break;
    }

    if (arg.startsWith("--")) {
      i++;
      continue;
    }

    const optLetter = arg.substring(0, 2);
    if (OPTIONS_WITH_ARG.has(optLetter)) {
      if (arg.length > 2) {
        i++;
      } else {
        i += 2;
      }
      continue;
    }

    if (arg.startsWith("-i") || arg.startsWith("-e")) {
      i++;
      continue;
    }

    i++;
  }

  if (i < args.length) {
    const cmd = args[i];
    if (cmd.includes("/")) {
      return cmd.split("/").pop()?.toLowerCase() || null;
    }
    return cmd.toLowerCase();
  }

  return null;
}

const MINIMAL_GIT_SUBCOMMANDS = new Set([
  "status",
  "log",
  "diff",
  "show",
  "branch",
  "remote",
  "tag",
  "ls-files",
  "ls-tree",
  "cat-file",
  "rev-parse",
  "describe",
  "shortlog",
  "blame",
  "annotate",
  "whatchanged",
  "reflog",
  "fetch",
]);

const MINIMAL_PACKAGE_SUBCOMMANDS: Record<string, Set<string>> = {
  npm: new Set([
    "list",
    "ls",
    "info",
    "view",
    "outdated",
    "audit",
    "explain",
    "why",
    "search",
  ]),
  yarn: new Set(["list", "info", "why", "outdated", "audit"]),
  pnpm: new Set(["list", "ls", "outdated", "audit", "why"]),
  bun: new Set(["pm", "ls"]),
  pip: new Set(["list", "show", "freeze", "check"]),
  pip3: new Set(["list", "show", "freeze", "check"]),
  cargo: new Set(["tree", "metadata", "search", "info"]),
  go: new Set(["list", "version", "env"]),
  gem: new Set(["list", "info", "search", "query"]),
  composer: new Set(["show", "info", "search", "outdated", "audit"]),
  dotnet: new Set(["list", "nuget"]),
  flutter: new Set(["doctor", "devices", "config"]),
  dart: new Set(["info"]),
};

function isMinimalLevel(tokens: string[]): boolean {
  if (tokens.length === 0) return true;

  const cmd = getCommandName(tokens);
  const fullCmd = tokens[0];
  const subCmd = tokens.length > 1 ? tokens[1].toLowerCase() : "";

  if (tokens.length === 1 && FD_NUMBERS.has(fullCmd)) return true;
  if (REDIRECTION_TARGETS.has(fullCmd)) return true;

  const conditionalCheck = CONDITIONAL_WRITE_COMMANDS[cmd];
  if (conditionalCheck) {
    if (conditionalCheck(tokens)) {
      return false;
    }
    return true;
  }

  if (MINIMAL_COMMANDS.has(cmd)) return true;

  if (
    tokens.includes("--version") ||
    tokens.includes("-v") ||
    tokens.includes("-V")
  ) {
    return true;
  }

  if (cmd === "git" && subCmd && MINIMAL_GIT_SUBCOMMANDS.has(subCmd)) {
    const READ_ONLY_WITHOUT_ARGS = new Set(["branch", "tag", "remote"]);
    if (READ_ONLY_WITHOUT_ARGS.has(subCmd)) {
      const nonFlagArgs = tokens.slice(2).filter((t) => !t.startsWith("-"));
      if (nonFlagArgs.length > 0) {
        return false;
      }
    }
    return true;
  }

  if (MINIMAL_PACKAGE_SUBCOMMANDS[cmd]?.has(subCmd)) {
    return true;
  }

  return false;
}

// ============================================================================
// LEVEL CLASSIFICATION - MEDIUM
// ============================================================================

const MEDIUM_PACKAGE_PATTERNS: Array<[string, RegExp]> = [
  [
    "npm",
    /^(install|ci|add|remove|uninstall|update|rebuild|dedupe|prune|link|pack|test|build)$/,
  ],
  ["yarn", /^(install|add|remove|upgrade|import|link|pack|test|build)$/],
  ["pnpm", /^(install|add|remove|update|link|pack|test|build)$/],
  ["bun", /^(install|add|remove|update|link|test|build)$/],
  ["pip", /^install$/],
  ["pip3", /^install$/],
  ["pipenv", /^(install|update|sync|lock|uninstall)$/],
  ["poetry", /^(install|add|remove|update|lock|build)$/],
  ["conda", /^(install|update|remove|create)$/],
  ["uv", /^(pip|sync|lock)$/],
  ["pytest", /./],
  [
    "cargo",
    /^(install|add|remove|fetch|update|build|test|check|clippy|fmt|doc|bench|clean)$/,
  ],
  ["rustfmt", /./],
  ["rustc", /./],
  ["go", /^(get|mod|build|test|generate|fmt|vet|clean|install)$/],
  ["gem", /^install$/],
  ["bundle", /^(install|update|add|remove|binstubs)$/],
  ["bundler", /^(install|update|add|remove)$/],
  ["pod", /^(install|update|repo)$/],
  ["rspec", /./],
  ["composer", /^(install|require|remove|update|dump-autoload)$/],
  ["phpunit", /./],
  ["mvn", /^(install|compile|test|package|clean|dependency|verify)$/],
  ["gradle", /^(build|test|clean|assemble|dependencies|check)$/],
  ["dotnet", /^(restore|add|build|test|clean|publish|pack|new)$/],
  ["nuget", /^install$/],
  ["dart", /^(pub|compile|test|analyze|format|fix)$/],
  ["flutter", /^(pub|build|test|analyze|clean|create|doctor)$/],
  ["pub", /^(get|upgrade|downgrade|cache|deps)$/],
  ["swift", /^(package|build|test)$/],
  ["swiftc", /./],
  ["mix", /^(deps|compile|test|ecto|phx\.gen)$/],
  ["cabal", /^(install|build|test|update)$/],
  ["stack", /^(install|build|test|setup)$/],
  ["ghc", /./],
  ["nimble", /^install$/],
  ["zig", /^(build|test|fetch)$/],
  ["cmake", /./],
  ["make", /./],
  ["ninja", /./],
  ["meson", /./],
  ["eslint", /./],
  ["prettier", /./],
  ["black", /./],
  ["flake8", /./],
  ["pylint", /./],
  ["ruff", /./],
  ["pyflakes", /./],
  ["bandit", /./],
  ["mypy", /./],
  ["pyright", /./],
  ["tsc", /./],
  ["tslint", /./],
  ["standard", /./],
  ["xo", /./],
  ["rubocop", /./],
  ["standardrb", /./],
  ["reek", /./],
  ["brakeman", /./],
  ["golangci-lint", /./],
  ["gofmt", /./],
  ["go vet", /./],
  ["golint", /./],
  ["staticcheck", /./],
  ["errcheck", /./],
  ["misspell", /./],
  ["swiftlint", /./],
  ["swiftformat", /./],
  ["ktlint", /./],
  ["detekt", /./],
  ["dartanalyzer", /./],
  ["dartfmt", /./],
  ["clang-tidy", /./],
  ["clang-format", /./],
  ["cppcheck", /./],
  ["checkstyle", /./],
  ["pmd", /./],
  ["spotbugs", /./],
  ["sonarqube", /./],
  ["phpcs", /./],
  ["phpmd", /./],
  ["phpstan", /./],
  ["psalm", /./],
  ["php-cs-fixer", /./],
  ["luacheck", /./],
  ["shellcheck", /./],
  ["checkov", /./],
  ["tflint", /./],
  ["buf", /./],
  ["sqlfluff", /./],
  ["yamllint", /./],
  ["markdownlint", /./],
  ["djlint", /./],
  ["djhtml", /./],
  ["commitlint", /./],
  ["jest", /./],
  ["mocha", /./],
  ["vitest", /./],
  ["mkdir", /./],
  ["touch", /./],
  ["cp", /./],
  ["mv", /./],
  ["ln", /./],
  ["prisma", /^(generate|migrate|db|studio)$/],
  ["sequelize", /^(db|migration)$/],
  ["typeorm", /^(migration)$/],
];

const MEDIUM_GIT_SUBCOMMANDS = new Set([
  "add",
  "commit",
  "pull",
  "checkout",
  "switch",
  "branch",
  "merge",
  "rebase",
  "cherry-pick",
  "stash",
  "revert",
  "tag",
  "rm",
  "mv",
  "reset",
  "clone",
]);

const SAFE_RUN_SCRIPTS = new Set([
  "build",
  "compile",
  "test",
  "lint",
  "format",
  "fmt",
  "check",
  "typecheck",
  "type-check",
  "types",
  "validate",
  "verify",
  "prepare",
  "prepublish",
  "prepublishOnly",
  "prepack",
  "postpack",
  "clean",
  "lint:fix",
  "format:check",
  "build:prod",
  "build:dev",
  "build:production",
  "build:development",
  "test:unit",
  "test:integration",
  "test:e2e",
  "test:coverage",
]);

const UNSAFE_RUN_SCRIPTS = new Set([
  "start",
  "dev",
  "develop",
  "serve",
  "server",
  "watch",
  "preview",
  "start:dev",
  "start:prod",
  "dev:server",
]);

function isSafeRunScript(script: string): boolean {
  const s = script.toLowerCase();
  if (SAFE_RUN_SCRIPTS.has(s)) return true;
  if (
    s.startsWith("build") ||
    s.startsWith("test") ||
    s.startsWith("lint") ||
    s.startsWith("format") ||
    s.startsWith("check") ||
    s.startsWith("type")
  ) {
    return true;
  }
  if (UNSAFE_RUN_SCRIPTS.has(s)) return false;
  if (
    s.startsWith("start") ||
    s.startsWith("dev") ||
    s.startsWith("serve") ||
    s.startsWith("watch")
  ) {
    return false;
  }
  return false;
}

function isMediumLevel(tokens: string[]): boolean {
  if (tokens.length === 0) return false;

  const cmd = getCommandName(tokens);
  const subCmd = tokens.length > 1 ? tokens[1].toLowerCase() : "";
  const thirdArg = tokens.length > 2 ? tokens[2] : "";

  if (cmd === "git") {
    if (subCmd === "push") return false;
    if (subCmd === "reset" && tokens.includes("--hard")) return false;
    if (MEDIUM_GIT_SUBCOMMANDS.has(subCmd)) return true;
  }

  if (["npm", "yarn", "pnpm", "bun"].includes(cmd) && subCmd === "run") {
    if (!thirdArg || thirdArg.startsWith("-")) return false;
    return isSafeRunScript(thirdArg);
  }

  for (const [pattern, subPattern] of MEDIUM_PACKAGE_PATTERNS) {
    if (cmd === pattern) {
      if (!subCmd || subPattern.test(subCmd)) {
        return true;
      }
    }
  }

  return false;
}

// ============================================================================
// LEVEL CLASSIFICATION - HIGH
// ============================================================================

function isHighLevel(tokens: string[]): boolean {
  if (tokens.length === 0) return false;

  const cmd = getCommandName(tokens);
  const subCmd = tokens.length > 1 ? tokens[1].toLowerCase() : "";
  const argsStr = tokens.slice(1).join(" ");

  if (cmd === "git" && subCmd === "push") return true;
  if (cmd === "git" && subCmd === "reset" && tokens.includes("--hard"))
    return true;
  if (cmd === "curl" || cmd === "wget") return true;

  if (cmd === "bash" || cmd === "sh" || cmd === "zsh") {
    if (argsStr.includes("http://") || argsStr.includes("https://"))
      return true;
  }

  if (cmd === "docker" && ["push", "login", "logout"].includes(subCmd))
    return true;

  if (["kubectl", "helm", "terraform", "pulumi", "ansible"].includes(cmd))
    return true;
  if (["ssh", "scp", "rsync"].includes(cmd)) return true;

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
