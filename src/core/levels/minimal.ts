/**
 * Minimal level classification - read-only, version checks, safe commands
 */

import { getCommandName } from "./index";

// Broad set of /dev/* paths that count as minimal-level tokens
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

// ============================================================================
// HELPERS
// ============================================================================

const extractXargsCommand = (tokens: string[]): string | null => {
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
};

// ============================================================================
// LEVEL CHECK
// ============================================================================

export const isMinimalLevel = (tokens: string[]): boolean => {
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
};
