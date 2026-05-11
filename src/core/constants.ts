/**
 * Static constants used across the classifier pipeline.
 *
 * Kept separate from classifier.ts to keep the classification logic focused
 * on the "how" while this file defines the "what".
 */

// ============================================================================
// SHELL EXECUTION COMMANDS
// ============================================================================
// Commands that can execute arbitrary code.
export const SHELL_EXECUTION_COMMANDS = new Set([
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

// ============================================================================
// SHELL TRICK PATTERNS
// ============================================================================
// Patterns that indicate command substitution or shell tricks in raw command.
export const SHELL_TRICK_PATTERNS: RegExp[] = [
  /\$\((?!\()[^)]+\)/, // $(command) - command substitution (exclude $(( for arithmetic)
  /`[^`]+`/, // `command` - backtick substitution
  /<\([^)]+\)/, // <(command) - process substitution (input)
  />\([^)]+\)/, // >(command) - process substitution (output)
];

// ============================================================================
// REDIRECTION OPERATORS
// ============================================================================
// Output redirection operators that write to files.
export const OUTPUT_REDIRECTION_OPS = new Set([">", ">>", ">|", "&>", "&>>"]);

// All redirection operators (including input).
export const ALL_REDIRECTION_OPS = new Set([
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

// Command separators used to split pipeline segments.
export const COMMAND_SEPARATORS = new Set(["|", "&&", "||", ";", "&"]);

// ============================================================================
// SAFE REDIRECTION TARGETS
// ============================================================================
// Redirection targets that are not actual file writes.
export const SAFE_REDIRECTION_TARGETS = new Set([
  "/dev/null",
  "/dev/stdout",
  "/dev/stderr",
  "/dev/fd/1",
  "/dev/fd/2",
]);
