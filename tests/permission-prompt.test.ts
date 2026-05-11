/**
 * Tests for permission prompt UI behavior
 *
 * Covers handleBashToolCall, handleWriteToolCall, handleMcpToolCall,
 * and the requestPermission helper (tested indirectly).
 *
 * Run with: npx tsx tests/permission-prompt.test.ts
 */

import {
  handleBashToolCall,
  handleWriteToolCall,
  handleMcpToolCall,
  createInitialState,
  type PermissionState,
} from "../src/permission.js";

// ============================================================================
// Test runner (same pattern as permission.test.ts)
// ============================================================================

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const tests: Array<{ name: string; fn: () => Promise<void> }> = [];

function test(name: string, fn: () => Promise<void>) {
  tests.push({ name, fn });
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

async function runTests() {
  console.log("Running permission prompt tests...\n");
  const results: TestResult[] = [];

  for (const { name, fn } of tests) {
    try {
      await fn();
      results.push({ name, passed: true });
      console.log(`  ${name}... ✓`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ name, passed: false, error: message });
      console.log(`  ${name}... ✗`);
      console.log(`    ${message}`);
    }
  }

  console.log();
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

// ============================================================================
// Mock context factory
// ============================================================================

interface SelectCall {
  message: string;
  options: string[];
}

interface NotifyCall {
  message: string;
  type: string;
}

interface MockCtx {
  hasUI: boolean;
  ui: {
    select: (message: string, options: string[]) => Promise<string | null>;
    notify: (message: string, type: string) => void;
    setStatus: (key: string, value: string) => void;
  };
  selectCalls: SelectCall[];
  notifyCalls: NotifyCall[];
}

function makeCtx(selectResponse: string | null = "Cancel"): MockCtx {
  const selectCalls: SelectCall[] = [];
  const notifyCalls: NotifyCall[] = [];

  return {
    hasUI: true,
    ui: {
      select: async (message: string, options: string[]) => {
        selectCalls.push({ message, options });
        return selectResponse;
      },
      notify: (message: string, type: string) => {
        notifyCalls.push({ message, type });
      },
      setStatus: () => {},
    },
    selectCalls,
    notifyCalls,
  };
}

/** State at minimal level (default) */
function minimalState(): PermissionState {
  return createInitialState(); // defaults to minimal
}

/** State at a specific level */
function stateAt(level: PermissionState["currentLevel"]): PermissionState {
  const s = createInitialState();
  s.currentLevel = level;
  return s;
}

// ============================================================================
// handleBashToolCall - command displayed in prompt
// ============================================================================

test("bash prompt: command shown with $ prefix in message", async () => {
  const state = minimalState();
  const ctx = makeCtx("Cancel");

  await handleBashToolCall(state, "git push origin main", ctx);

  assert(ctx.selectCalls.length > 0, "select should have been called");
  const { message } = ctx.selectCalls[0];
  assert(
    message.startsWith("$ git push origin main"),
    `Expected message to start with "$ git push origin main", got: "${message}"`
  );
});

test("bash prompt: short command is not truncated", async () => {
  const state = minimalState();
  const ctx = makeCtx("Cancel");

  await handleBashToolCall(state, "npm install", ctx);

  assert(ctx.selectCalls.length > 0, "select should have been called");
  const { message } = ctx.selectCalls[0];
  assert(
    message.includes("npm install"),
    `Expected message to contain "npm install", got: "${message}"`
  );
  assert(!message.includes("…"), "Short command should not be truncated");
});

test("bash prompt: long command is truncated with ellipsis", async () => {
  const state = minimalState();
  const ctx = makeCtx("Cancel");

  // 90-char command - well over the 80-char truncation limit
  const longCmd = "git commit -m '" + "x".repeat(80) + "'";
  await handleBashToolCall(state, longCmd, ctx);

  assert(ctx.selectCalls.length > 0, "select should have been called");
  const { message } = ctx.selectCalls[0];
  assert(message.includes("…"), "Long command should end with ellipsis");
  // The $ prefix + truncated command should not exceed 83 chars (2 for "$ " + 80 for content + 1 for …)
  const displayedCmd = message.split("  [")[0]; // strip " [requires ...]"
  assert(
    displayedCmd.length <= 83,
    `Displayed command too long: ${displayedCmd.length} chars`
  );
});

test("bash prompt: required level shown in message", async () => {
  const state = minimalState(); // level: minimal
  const ctx = makeCtx("Cancel");

  // git push requires HIGH
  await handleBashToolCall(state, "git push origin main", ctx);

  assert(ctx.selectCalls.length > 0, "select should have been called");
  const { message } = ctx.selectCalls[0];
  assert(
    message.includes("[requires High]"),
    `Expected "[requires High]" in message, got: "${message}"`
  );
});

test("bash prompt: medium-level command shows correct required level", async () => {
  const state = minimalState();
  const ctx = makeCtx("Cancel");

  // npm install requires MEDIUM
  await handleBashToolCall(state, "npm install", ctx);

  assert(ctx.selectCalls.length > 0, "select should have been called");
  const { message } = ctx.selectCalls[0];
  assert(
    message.includes("[requires Medium]"),
    `Expected "[requires Medium]" in message, got: "${message}"`
  );
});

// ============================================================================
// handleBashToolCall - options
// ============================================================================

test("bash prompt: options include Allow once, Allow all, Cancel", async () => {
  const state = minimalState();
  const ctx = makeCtx("Cancel");

  await handleBashToolCall(state, "git push", ctx);

  assert(ctx.selectCalls.length > 0, "select should have been called");
  const { options } = ctx.selectCalls[0];
  assert(options.includes("Allow once"), "Options should include 'Allow once'");
  assert(options.includes("Cancel"), "Options should include 'Cancel'");
  const allowAll = options.find((o) => o.startsWith("Allow all"));
  assert(!!allowAll, "Options should include an 'Allow all ...' option");
});

test("bash prompt: Allow all option includes level and (session)", async () => {
  const state = minimalState();
  const ctx = makeCtx("Cancel");

  await handleBashToolCall(state, "git push", ctx);

  const { options } = ctx.selectCalls[0];
  const allowAll = options.find((o) => o.startsWith("Allow all"));
  assert(
    allowAll === "Allow all High (session)",
    `Expected "Allow all High (session)", got: "${allowAll}"`
  );
});

test("bash prompt: Allow all option uses correct level for medium commands", async () => {
  const state = minimalState();
  const ctx = makeCtx("Cancel");

  await handleBashToolCall(state, "npm install", ctx);

  const { options } = ctx.selectCalls[0];
  const allowAll = options.find((o) => o.startsWith("Allow all"));
  assert(
    allowAll === "Allow all Medium (session)",
    `Expected "Allow all Medium (session)", got: "${allowAll}"`
  );
});

// ============================================================================
// handleBashToolCall - allow/block behavior
// ============================================================================

test("bash: Allow once returns undefined (allows command)", async () => {
  const state = minimalState();
  const ctx = makeCtx("Allow once");

  const result = await handleBashToolCall(state, "git push", ctx);
  assertEqual(result, undefined, "Allow once should return undefined");
});

test("bash: Cancel returns block result", async () => {
  const state = minimalState();
  const ctx = makeCtx("Cancel");

  const result = await handleBashToolCall(state, "git push", ctx);
  assert(result !== undefined, "Cancel should return a block result");
  assert(result!.block === true, "block should be true");
  assert(
    result!.reason.includes("Cancelled"),
    `Reason should mention cancellation: "${result!.reason}"`
  );
});

test("bash: Allow all upgrades state level for session", async () => {
  const state = minimalState();
  const ctx = makeCtx("Allow all High (session)");

  const result = await handleBashToolCall(state, "git push", ctx);
  assertEqual(result, undefined, "Allow all should permit the command");
  assertEqual(state.currentLevel, "high", "State level should be upgraded to high");
  assertEqual(state.isSessionOnly, true, "Should be session-only (not saved globally)");
});

test("bash: Allow all Medium upgrades state to medium", async () => {
  const state = minimalState();
  const ctx = makeCtx("Allow all Medium (session)");

  const result = await handleBashToolCall(state, "npm install", ctx);
  assertEqual(result, undefined, "Allow all should permit the command");
  assertEqual(state.currentLevel, "medium", "State level should be upgraded to medium");
});

test("bash: sufficient permission - no prompt shown", async () => {
  const state = stateAt("high");
  const ctx = makeCtx("Cancel");

  // git push requires high - state is already high, no prompt
  const result = await handleBashToolCall(state, "git push", ctx);
  assertEqual(result, undefined, "Should allow without prompting");
  assertEqual(ctx.selectCalls.length, 0, "select should NOT have been called");
});

test("bash: minimal commands always pass through without prompt", async () => {
  const state = minimalState();
  const ctx = makeCtx("Cancel");

  const result = await handleBashToolCall(state, "ls -la", ctx);
  assertEqual(result, undefined, "Minimal command should pass through");
  assertEqual(ctx.selectCalls.length, 0, "select should NOT have been called");
});

test("bash: bypassed level skips all checks", async () => {
  const state = stateAt("bypassed");
  const ctx = makeCtx("Cancel");

  const result = await handleBashToolCall(state, "sudo rm -rf /", ctx);
  assertEqual(result, undefined, "Bypassed should allow everything");
  assertEqual(ctx.selectCalls.length, 0, "select should NOT have been called");
});

// ============================================================================
// Dangerous command prompt
// ============================================================================

test("dangerous: select title shows command with $ prefix", async () => {
  const state = minimalState();
  const ctx = makeCtx("Cancel");

  await handleBashToolCall(state, "rm -rf /tmp/test", ctx);

  assert(ctx.selectCalls.length > 0, "select should have been called");
  const { message } = ctx.selectCalls[0];
  assert(
    message.startsWith("⚠️ Dangerous: $ "),
    `Expected "⚠️ Dangerous: $ " prefix, got: "${message}"`
  );
  assert(
    message.includes("rm -rf /tmp/test"),
    `Expected command in title, got: "${message}"`
  );
});

test("dangerous: options are Allow once and Cancel only", async () => {
  const state = minimalState();
  const ctx = makeCtx("Cancel");

  await handleBashToolCall(state, "sudo apt-get install pkg", ctx);

  assert(ctx.selectCalls.length > 0, "select should have been called");
  const { options } = ctx.selectCalls[0];
  assertEqual(options.length, 2, "Dangerous prompt should have exactly 2 options");
  assert(options.includes("Allow once"), "Options should include 'Allow once'");
  assert(options.includes("Cancel"), "Options should include 'Cancel'");
  // No "Allow all" for dangerous commands
  assert(
    !options.some((o) => o.startsWith("Allow all")),
    "Dangerous prompt should NOT have 'Allow all' option"
  );
});

test("dangerous: Allow once permits command", async () => {
  const state = minimalState();
  const ctx = makeCtx("Allow once");

  const result = await handleBashToolCall(state, "rm -rf /tmp/test", ctx);
  assertEqual(result, undefined, "Allow once should permit dangerous command");
});

test("dangerous: Cancel blocks command", async () => {
  const state = minimalState();
  const ctx = makeCtx("Cancel");

  const result = await handleBashToolCall(state, "rm -rf /tmp/test", ctx);
  assert(result !== undefined, "Cancel should block");
  assert(result!.block === true, "block should be true");
});

test("dangerous: long dangerous command is truncated in title", async () => {
  const state = minimalState();
  const ctx = makeCtx("Cancel");

  const longDangerousCmd = "sudo rm -rf /tmp/" + "a".repeat(100);
  await handleBashToolCall(state, longDangerousCmd, ctx);

  const { message } = ctx.selectCalls[0];
  assert(message.includes("…"), "Long dangerous command should be truncated");
});

// ============================================================================
// handleWriteToolCall
// ============================================================================

test("write: prompts at minimal level", async () => {
  const state = minimalState();
  const ctx = makeCtx("Cancel");

  const result = await handleWriteToolCall({
    state,
    toolName: "write",
    filePath: "/tmp/file.txt",
    ctx,
  });

  assert(result !== undefined, "Should block at minimal level");
  assert(ctx.selectCalls.length > 0, "select should have been called");
});

test("write: no prompt at low or above", async () => {
  const state = stateAt("low");
  const ctx = makeCtx("Cancel");

  const result = await handleWriteToolCall({
    state,
    toolName: "write",
    filePath: "/tmp/file.txt",
    ctx,
  });

  assertEqual(result, undefined, "Should allow at low level");
  assertEqual(ctx.selectCalls.length, 0, "select should NOT have been called");
});

test("write: prompt title includes file path", async () => {
  const state = minimalState();
  const ctx = makeCtx("Cancel");

  await handleWriteToolCall({
    state,
    toolName: "write",
    filePath: "/src/index.ts",
    ctx,
  });

  assert(ctx.selectCalls.length > 0, "select should have been called");
  const { message } = ctx.selectCalls[0];
  assert(
    message.includes("/src/index.ts"),
    `Expected file path in message, got: "${message}"`
  );
});

test("write: Allow all upgrades state to low", async () => {
  const state = minimalState();
  const ctx = makeCtx("Allow all Low (session)");

  const result = await handleWriteToolCall({
    state,
    toolName: "write",
    filePath: "/tmp/file.txt",
    ctx,
  });

  assertEqual(result, undefined, "Should allow");
  assertEqual(state.currentLevel, "low", "State should be upgraded to low");
});

// ============================================================================
// handleMcpToolCall
// ============================================================================

test("mcp: prompts at minimal level with tool name", async () => {
  const state = minimalState();
  const ctx = makeCtx("Cancel");

  await handleMcpToolCall(
    state,
    JSON.stringify({ tool: "filesystem_read" }),
    ctx
  );

  assert(ctx.selectCalls.length > 0, "select should have been called");
  const { message } = ctx.selectCalls[0];
  assert(
    message.includes("filesystem_read"),
    `Expected tool name in message, got: "${message}"`
  );
});

test("mcp: no prompt at medium or above", async () => {
  const state = stateAt("medium");
  const ctx = makeCtx("Cancel");

  await handleMcpToolCall(
    state,
    JSON.stringify({ tool: "some_tool" }),
    ctx
  );

  // At medium, it notifies but does NOT prompt via select
  assertEqual(ctx.selectCalls.length, 0, "select should NOT have been called at medium");
  assert(
    ctx.notifyCalls.some((n) => n.message.includes("some_tool")),
    "Should notify about the tool call"
  );
});

test("mcp: unknown args still show a prompt", async () => {
  const state = minimalState();
  const ctx = makeCtx("Cancel");

  // Invalid JSON
  await handleMcpToolCall(state, "not-json", ctx);

  assert(ctx.selectCalls.length > 0, "select should have been called");
});

// ============================================================================
// Block mode
// ============================================================================

test("block mode: blocks without prompting", async () => {
  const state = minimalState();
  state.permissionMode = "block";
  const ctx = makeCtx("Allow once"); // would succeed if prompted

  const result = await handleBashToolCall(state, "git push", ctx);

  assert(result !== undefined, "Should block in block mode");
  assert(result!.block === true, "block should be true");
  assertEqual(ctx.selectCalls.length, 0, "select should NOT be called in block mode");
  assert(
    result!.reason.includes("block"),
    `Reason should mention block mode: "${result!.reason}"`
  );
});

test("block mode: dangerous command also blocks without prompting", async () => {
  const state = minimalState();
  state.permissionMode = "block";
  const ctx = makeCtx("Allow once");

  const result = await handleBashToolCall(state, "rm -rf /tmp", ctx);

  assert(result !== undefined, "Should block dangerous command in block mode");
  assertEqual(ctx.selectCalls.length, 0, "select should NOT be called in block mode");
});

// ============================================================================
// Non-interactive mode (no UI)
// ============================================================================

test("no UI: blocks without prompting", async () => {
  const state = minimalState();
  const ctx = {
    hasUI: false, // non-interactive
    ui: {
      select: async () => "Allow once" as string | null,
      notify: () => {},
      setStatus: () => {},
    },
  };

  const result = await handleBashToolCall(state, "git push", ctx);

  assert(result !== undefined, "Should block when no UI");
  assert(result!.block === true, "block should be true");
});

// ============================================================================
// Run
// ============================================================================

runTests();
