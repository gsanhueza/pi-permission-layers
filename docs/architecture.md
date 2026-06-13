# Architecture

## Major Files

```
src/
├── index.ts                # Extension entry point — registers commands, completions & event hooks
├── autocomplete.ts         # getPermissionCompletions, getPermissionModeCompletions (tab completion)
│
├── core/                   # Engine — classification, config, types (strategy-agnostic)
│   ├── classifiers/
│   │   ├── shell-classifier.ts     # classifyCommand(), parseCommand(), dangerous command detection
│   │   ├── permission-resolver.ts  # Shared resolution algorithm (resolveLevel)
│   │   ├── tool-classifier.ts      # Tool permission classification (resolveToolLevel)
│   │   └── mcp-classifier.ts       # MCP permission classification (resolveMcpLevel)
│   ├── constants.ts        # Shell trick patterns, redirection ops, command separators
│   ├── manager.ts          # SettingsManager class (file I/O, atomic writes, validation)
│   ├── settings.ts         # Global settings persistence (delegates to SettingsManager)
│   ├── config.ts           # Config caching, glob→regex conversion, override checking, prefix mappings
│   ├── interfaces.ts       # PermissionConfig, PermissionOverrides, PermissionPrefixMapping, etc.
│   ├── types.ts            # PermissionLevel, PermissionMode, LEVELS, LEVEL_INFO, PERMISSION_MODES
│   └── levels/
│       ├── index.ts        # `getCommandName()` helper + re-exports `isMinimalLevel`, `isMediumLevel`, `isHighLevel`
│       ├── minimal.ts      # Minimal level classification (read-only commands)
│       ├── medium.ts       # Medium level classification (build/install/test)
│       └── high.ts         # High level classification (network/deployment/shell execution)
│
└── strategies/              # Strategy pattern — UI vs no-UI presentation
    ├── interfaces.ts        # PermissionStrategy interface
    ├── base-strategy.ts     # Abstract base — owns the shared permission algorithm
    ├── ui-strategy.ts       # Interactive strategy — prompts, status bar, system notifications
    ├── no-ui-strategy.ts    # Non-interactive strategy — block messages, no prompts
    └── internal/            # Internal utilities (not a public API)
        ├── permission-check.ts    # checkPermission — shared bypass + level comparison guard
        ├── tool-permission.ts     # classifyAndCheck — shared decision tree for tool permission checks
        ├── mcp-input.ts           # parseMcpInput, McpToolInfo, McpToolInput
        ├── commands.ts            # handleConfigSubcommand, notify
        ├── events.ts              # initializeSessionState
        ├── settings-ui.ts         # createSettingsList — interactive TUI settings
        ├── ui-rendering.ts        # getStatusText, isQuietMode, notifySystem, terminal detection
        └── ui-detection.ts        # hasInteractiveUI — decides which strategy to use

tests/
├── check-permission.test.ts        # checkPermission() — bypass + level comparison guard
├── classify-and-check.test.ts      # classifyAndCheck() — shared decision tree for tool permission
├── config-subcommand.test.ts       # handleConfigSubcommand — config show/reset/help
├── config-validation.test.ts       # SettingsManager validation
├── fixtures/
│   ├── helpers.ts                  # Test helpers
│   └── mock-settings.json          # Mock settings for tests
├── interactive-ui.test.ts          # hasInteractiveUI, isQuietMode, notifySystem, terminal detection
├── mcp-input-parsing.test.ts       # parseMcpInput() — MCP tool input parsing
├── mcp-permission.test.ts          # MCP tool permission classification
├── permission-prompt.test.ts       # UI prompt behavior tests
├── session-only-behavior.test.ts   # Session-only vs global persistence behavior
├── shell-permission.test.ts        # Command classification tests
├── strategy-hooks.test.ts          # Abstract hook behavior (UI vs no-UI)
├── tool-permission.test.ts         # Tool permission classification and shared decision tree
└── ui-rendering.test.ts            # getStatusText, isQuietMode, notifySystem, terminal bundle ID detection
```

## Testing

Run tests with:

```bash
npm run test
```

### Test Structure

- **check-permission.test.ts** — Tests `checkPermission()` — shared bypass + level comparison guard
- **classify-and-check.test.ts** — Tests `classifyAndCheck()` — shared decision tree for tool permission checks
- **config-subcommand.test.ts** — Tests `handleConfigSubcommand()` — config show/reset/help
- **config-validation.test.ts** — Tests `SettingsManager` validation (overrides, tools, MCP, prefix mappings)
- **interactive-ui.test.ts** — Tests `hasInteractiveUI()`, `isQuietMode()`, `notifySystem()`, terminal detection, `systemNotifications` handling
- **mcp-input-parsing.test.ts** — Tests `parseMcpInput()` — MCP tool input parsing
- **mcp-permission.test.ts** — Tests MCP tool permission classification
- **permission-prompt.test.ts** — Tests UI handler functions
  - Tests prompt messages and options
  - Tests Allow/Cancel/Block behavior
  - Tests block mode vs ask mode
- **session-only-behavior.test.ts** — Tests session-only vs global persistence behavior
- **shell-permission.test.ts** — Tests `classifyCommand()` directly
  - Covers all 5 permission levels
  - Tests command parsing, pipelines, redirections
  - Tests shell tricks (`$()`, backticks, `eval`)
  - Tests config overrides and prefix mappings
- **strategy-hooks.test.ts** — Tests abstract hook behavior (UI vs no-UI implementations)
- **tool-permission.test.ts** — Tests tool permission classification and the shared decision tree
- **ui-rendering.test.ts** — Tests `getStatusText()`, `isQuietMode()`, `notifySystem()`, terminal bundle ID detection

> **New features MUST be covered by tests.** All command classification changes require test updates. Run `npm run test` before committing.

## Directory Structure

### `core/` — Engine (Strategy-Agnostic)

Low-level classification, config, and types. Used by both UI and no-UI strategies.

See the individual module descriptions below.

### `strategies/` — Strategy Pattern

The entry point (`index.ts`) selects between two strategies based on `hasInteractiveUI(ctx)`:

- **`UIPermissionStrategy`** — Used when running interactively. Implements prompts (select menus), status bar updates, and system notifications.
- **`NoUIPermissionStrategy`** — Used in print mode (`pi -p`), CI, or when the agent has no UI. Returns block messages with helpful hints. No prompts.

Both share the same permission algorithm via `BasePermissionStrategy` (abstract base class). The base class owns:
- State management (`PermissionState`)
- `handleBashToolCall()`, `handleMcpToolCall()`, `handleWriteToolCall()`, `handleToolCall()`, `checkAndHandleTool()`
- `handlePermissionCommand()`, `handlePermissionModeCommand()`
- `setLevel()`, `setMode()`, `createInitialState()`
- Abstract hooks that concrete strategies implement: `onDangerous()`, `onRequest()`, `onMcpAllowed()`, `onSessionStart()`, `onViewLevel()`, `onSetLevel()`, `onViewMode()`, `onSetMode()`, `onSettings()`, `configPrefix()`

### `strategies/internal/` — Internal Utilities

Shared code internal to the strategy module. Not a public API.

- `permission-check.ts` — `checkPermission()` — shared bypass + level comparison guard used by both UI and no-UI strategies
- `tool-permission.ts` — `classifyAndCheck()` — shared decision tree (unknown → dangerous → level → allow) used by both strategies
- `mcp-input.ts` — MCP input parsing: `parseMcpInput()` parses MCP tool call input, delegates to `resolveMcpLevel()` for config-based classification
- `commands.ts` — `handleConfigSubcommand()` (config show/reset/help), `notify()` (unified notification helper)
- `events.ts` — `initializeSessionState()` (loads env var or global settings)
- `settings-ui.ts` — `createSettingsList()` — renders an interactive TUI `SettingsList` for toggling `quietStartup`, `forceUI`, and `systemNotifications`
- `ui-rendering.ts` — `getStatusText()`, `isQuietMode()`, `notifySystem()`, terminal bundle ID detection (macOS: Ghostty, iTerm2, Kitty, Alacritty, Warp, Apple Terminal, VS Code), tmux awareness
- `ui-detection.ts` — `hasInteractiveUI(ctx)` — detects interactive context:
  1. `PI_FORCEUI` env var override (`1`, `true`, `yes`)
  2. `forceUI` setting in `permissionConfig`
  3. `ctx.hasUI` from the agent context
  4. `--mode` flag from argv (via `--mode=` or `--mode <value>`)
  5. Returns `true` if any of the above indicate interactivity

### `index.ts` — Entry Point

Default export function that receives the `ExtensionAPI` instance. Registers commands with tab completions and event hooks. Selects the active strategy on `session_start`:

```ts
let strategy: PermissionStrategy = new NoUIPermissionStrategy();

pi.on("session_start", async (_event: SessionStartEvent, ctx: ExtensionContext) => {
  if (hasInteractiveUI(ctx)) strategy = new UIPermissionStrategy();
  strategy.handleSessionStart(ctx);
});
```

**Registered commands:**
- `permission` — View or change permission level (with `getArgumentCompletions`)
- `permission-mode` — Set permission prompt mode (`ask`/`block`)

**Registered events:**
- `session_start` — Initialize strategy and session state
- `tool_call` — Route to strategy's `handleToolCall()`

## Permission-Core → Split into `core/`

The original monolithic `permission-core.ts` was refactored into focused modules:

### `core/classifiers/shell-classifier.ts`

Pure functions for command classification:
- `classifyCommand()` — Determines permission level for any shell command
- `parseCommand()` — Shell parsing with operator detection (pipes, redirects, separators)
- `detectShellTricks()` — Detects `$(cmd)`, backticks, process substitution, dangerous brace expansions
- `hasDangerousExpansion()` — Checks for `${...}` patterns containing `$(cmd)` or backticks
- `isDangerousCommand()` — Detects `sudo`, `rm -rf`, `chmod 777`, `dd of=/dev/*`, `mkfs`, `shutdown`, fork bombs

### `core/settings.ts`

Settings persistence — thin wrapper around `SettingsManager`:
- `loadGlobalPermissionLevel()` / `saveGlobalPermissionLevel()` — `permissionLevel` in settings.json
- `loadGlobalPermissionMode()` / `saveGlobalPermissionMode()` — `permissionMode` in settings.json
- `loadPermissionConfig()` / `savePermissionConfig()` — `permissionConfig` overrides & prefix mappings

Atomic file writes and validation are handled by `SettingsManager` (see `core/manager.ts` below).

### `core/classifiers/permission-resolver.ts`

Shared resolution algorithm (delta/override model):
- `resolveLevel(name, config, defaults)` — Resolves the effective permission level for any entry, checking user config then falling back to defaults
- `CONFIG_LEVELS` — Ordering: `high → medium → low → minimal`

Resolution order (most restrictive wins): dangerous → high → medium → low → minimal.

### `core/classifiers/tool-classifier.ts`

Tool permission classification:
- `resolveToolLevel(toolName, userConfig)` — Resolves the effective permission level for a tool
- `DEFAULT_TOOL_PERMISSIONS` — Built-in defaults: `read`/`ls`/`grep`/`find` → minimal, `write`/`edit` → low

### `core/classifiers/mcp-classifier.ts`

MCP permission classification:
- `resolveMcpLevel(targetTool, mode, userConfig)` — Resolves the effective permission level for an MCP tool call, checking tool name first then mode
- `DEFAULT_MCP_PERMISSIONS` — Modes (`search`, `describe`, `list`, `status`, `connect`) → minimal, known read-only MCP tools → low
- `KNOWN_MCP_MODES` — Set of recognized MCP modes (`search`, `describe`, `list`, `status`, `connect`, `call`, `action`)

### `core/manager.ts`

`SettingsManager` class — file I/O, atomic writes, and config validation:
- `load()` — Reads and parses `settings.json` (returns `{}` on failure)
- `save(settings)` — Atomic write: writes to `.tmp` file, then renames
- `validate(raw)` — Sanitizes `PermissionConfig`: strips invalid entries, caps overrides at 100 per level, tool/MCP entries at 100 per level, and prefix mappings at 50
- `validateOverrides(raw)` — Filters patterns to valid non-empty strings per level
- `validateToolConfig(raw)` — Filters tool entries to valid non-empty strings per level (100 cap)
- `validateMcpConfig(raw)` — Filters MCP entries to valid non-empty strings per level (100 cap)
- `validatePrefixMappings(raw)` — Filters mappings to valid `{from, to}` objects

### `core/config.ts`

Configuration utilities:
- `getCachedConfig()` — TTL-based cache (5 seconds) for permission config
- `globToRegex()` — Converts glob patterns to case-insensitive regex
- `matchesAnyPattern()` — Checks if a command matches any pattern in a level
- `applyPrefixMappings()` — Normalizes version-manager commands (`fvm flutter` → `flutter`)
- `checkOverrides()` — Checks overrides from most restrictive to least (dangerous → high → medium → low → minimal)
- `invalidateConfigCache()` — Clears config and regex caches

### `core/constants.ts`

Static classification data:
- `SHELL_EXECUTION_COMMANDS` — Set of: `eval`, `exec`, `source`, `.`, `env`, `command`, `builtin`, `time`, `nice`, `nohup`, `timeout`, `watch`, `strace`
- `SHELL_TRICK_PATTERNS` — RegExp patterns for: `$(cmd)`, backticks, `<(cmd)`, `>(cmd)`
- `OUTPUT_REDIRECTION_OPS` — Set of: `>`, `>>`, `>|`, `&>`, `&>>`
- `ALL_REDIRECTION_OPS` — Set including input redirection: `<`, `<&`, `<>`
- `COMMAND_SEPARATORS` — Set of: `|`, `&&`, `||`, `;`, `&`
- `SAFE_REDIRECTION_TARGETS` — Set of: `/dev/null`, `/dev/stdout`, `/dev/stderr`, `/dev/fd/1`, `/dev/fd/2`

### `core/levels/minimal.ts`

Read-only command classification:
- File reading: `cat`, `less`, `more`, `head`, `tail`, `bat`, `tac`
- Directory: `ls`, `tree`, `pwd`, `dir`, `vdir`, `cd`, `pushd`, `popd`, `fd`, `locate`
- Search: `grep`, `egrep`, `fgrep`, `rg`, `ag`, `ack`
- Info: `echo`, `printf`, `whoami`, `id`, `date`, `cal`, `uname`, `hostname`, `uptime`, `type`, `file`, `stat`, `wc`, `du`, `df`, `free`, `ps`, `top`, `htop`, `pgrep`, `sleep`, `man`, `help`, `info`, `sort`, `uniq`, `cut`, `awk`, `sed`, `tr`, `column`, `paste`, `join`, `comm`, `diff`, `cmp`, `patch`, `test`, `[`, `[[`, `true`, `false`
- Git read: `git status`, `git log`, `git diff`, `git show`, `git branch`, `git tag`, `git remote`, `git ls-files`, `git ls-tree`, `git cat-file`, `git rev-parse`, `git describe`, `git shortlog`, `git blame`, `git annotate`, `git whatchanged`, `git reflog`, `git fetch`
- Package info: `npm list/ls/info/view/outdated/audit/explain/why/search`, `yarn list/info/why/outdated/audit`, `pnpm list/ls/outdated/audit/why`, `bun pm/ls`, `pip/pip3 list/show/freeze/check`, `cargo tree/metadata/search/info`, `go list/version/env`, `gem list/info/search/query`, `composer show/info/search/outdated/audit`, `dotnet list/nuget`, `flutter doctor/devices/config`, `dart info`
- Conditional: `find` (without `-exec`/`-execdir`/`-ok`/`-okdir`/`-delete`), `xargs` (with minimal commands), `tee` (to /dev/null only)

### `core/levels/medium.ts`

Build/install/test classification:
- Package managers: `npm`, `yarn`, `pnpm`, `bun`, `pip`, `pip3`, `pipenv`, `poetry`, `conda`, `uv`, `cargo`, `rustfmt`, `rustc`, `go`, `gem`, `bundle`, `bundler`, `pod`, `rspec`, `composer`, `phpunit`, `mvn`, `gradle`, `dotnet`, `nuget`, `dart`, `flutter`, `pub`, `swift`, `swiftc`, `mix`, `cabal`, `stack`, `ghc`, `nimble`, `zig`, `cmake`, `make`, `ninja`, `meson`
- Linters (all subcommands): `eslint`, `prettier`, `black`, `flake8`, `pylint`, `ruff`, `pyflakes`, `bandit`, `mypy`, `pyright`, `tsc`, `tslint`, `standard`, `xo`, `rubocop`, `standardrb`, `reek`, `brakeman`, `golangci-lint`, `gofmt`, `go vet`, `golint`, `staticcheck`, `errcheck`, `misspell`, `swiftlint`, `swiftformat`, `ktlint`, `detekt`, `dartanalyzer`, `dartfmt`, `clang-tidy`, `clang-format`, `cppcheck`, `checkstyle`, `pmd`, `spotbugs`, `sonarqube`, `phpcs`, `phpmd`, `phpstan`, `psalm`, `php-cs-fixer`, `luacheck`, `shellcheck`, `checkov`, `tflint`, `buf`, `sqlfluff`, `yamllint`, `markdownlint`, `djlint`, `djhtml`, `commitlint`
- Test runners: `jest`, `mocha`, `vitest`, `pytest`, `rspec`, `phpunit`
- Git local: `git add`, `git commit`, `git pull`, `git checkout`, `git switch`, `git branch`, `git merge`, `git rebase`, `git cherry-pick`, `git stash`, `git revert`, `git tag`, `git rm`, `git mv`, `git reset`, `git clone`
- File ops: `mkdir`, `touch`, `cp`, `mv`, `ln`
- Safe `npm run` scripts: `build`, `compile`, `test`, `lint`, `format`, `fmt`, `check`, `typecheck`, `type-check`, `types`, `validate`, `verify`, `prepare`, `prepublish`, `prepublishOnly`, `prepack`, `postpack`, `clean`, and prefixed variants (`build:*`, `test:*`, `lint:*`, `format:*`, `check:*`, `type:*`)
- Unsafe `npm run` scripts: `start`, `dev`, `develop`, `serve`, `server`, `watch`, `preview`, and prefixed variants (`start:*`, `dev:*`, `serve:*`, `watch:*`)

### `core/levels/high.ts`

Network/deployment/shell execution:
- `git push`, `git reset --hard`
- `curl`, `wget`
- `bash`, `sh`, `zsh` (with HTTP URLs)
- `docker push/login/logout`
- `kubectl`, `helm`, `terraform`, `pulumi`, `ansible`
- `ssh`, `scp`, `rsync`

### `core/classifiers/shell-classifier.ts` — Shell Classification Pipeline

The classifier runs in this order:
1. **Prefix normalization** — `fvm flutter build` → `flutter build`
2. **Shell trick detection** — `$(cmd)`, backticks, `<(cmd)`, `>(cmd)`, `${VAR:-$(cmd)}` → always **high**
3. **Override check** — User-configured patterns (dangerous → high → medium → low → minimal, most restrictive wins)
4. **Output redirection** — `>`, `>>` to non-special files → minimum **low** (note: no `isLowLevel()` classifier exists; "low" is set only as a floor for file-writing commands)
5. **Per-command override** — Each command is checked against user-configured override patterns. If a match is found, the override replaces the command's classification entirely (prioritizing override over classifier):
   - `cd /tmp && command_a` with `overrides.low: ["command_a"]` → command `command_a` → **low** (not high from default classification)
   - `sudo ls` with `overrides.low: ["sudo ls"]` → **low** (override removes dangerous flag)
   - `rm -rf /` with `overrides.dangerous: ["rm -rf /"]` → **high + dangerous**
6. **Segment classification** — Each pipe/separator command is classified individually:
   - `SHELL_EXECUTION_COMMANDS` (Set: eval, exec, source, `.`, env, command, builtin, time, nice, nohup, timeout, watch, strace) → **high**
   - `isDangerousCommand()` (sudo, rm -rf, chmod 777, dd of=/dev/*, fdisk, parted, format, mkfs*, shutdown, reboot, halt, poweroff, init, fork bomb) → **high + dangerous flag**
   - `isMinimalLevel()` → **minimal**
   - `isMediumLevel()` → **medium**
   - `isHighLevel()` → **high**
   - Default fallback → **high**
7. **Pipeline trick detection** — If a pipe leads to `bash`, `sh`, `zsh`, `node`, `python`, `python3`, `ruby`, or `perl` → **high**
8. **Max level** — The highest level across all segments/commands wins

### Dangerous Command Detection (`isDangerousCommand`)

| Command | Condition |
|---|---|
| `sudo` | Any form |
| `rm` | Both `-r`/`--recursive` AND `-f`/`--force` |
| `chmod` | `777` or `a+rwx` |
| `dd` | `of=/dev/...` |
| `fdisk`, `parted`, `format` | Any form |
| `mkfs*` | Any variant |
| `shutdown`, `reboot`, `halt`, `poweroff`, `init` | Any form |
| Fork bomb | `:(){ :|:& };:` pattern |

### `core/types.ts`

Primitive types and constants:
- `PermissionLevel` — `"minimal" | "low" | "medium" | "high" | "bypassed"`
- `PermissionMode` — `"ask" | "block"`
- `LEVELS` — Ordered array: `["minimal", "low", "medium", "high", "bypassed"]`
- `PERMISSION_MODES` — Ordered array: `["ask", "block"]`
- `LEVEL_INDEX` — Numeric ordering: `minimal: 0, low: 1, medium: 2, high: 3, bypassed: 4`
- `LEVEL_INFO` — `{ label, desc }` per level: minimal=Read-only, low=File ops only, medium=Dev operations, high=Full operations, bypassed=All checks disabled
- `PERMISSION_MODE_INFO` — `{ label, desc }` per mode: ask=Prompt when permission is required, block=Block instead of prompting
- `LEVEL_INFO` also provides the short descriptions used in blocked messages (no separate `LEVEL_ALLOWED_DESC` constant)
- `Notification` — `"off" | "on" | "unfocused" | "persistent"` — Controls OS notification behavior:
  - `"off"` — Fully disabled, no notifications shown
  - `"on"` — Always shown regardless of focus
  - `"unfocused"` — Only shown when the terminal is not focused (default)
  - `"persistent"` — Always shown with critical/persistent priority (Linux: `-u critical` flag)

### `PermissionStrategy` Interface

The strategy contract that both UI and no-UI implementations share:
- `handlePermissionCommand(args, ctx)` — Handle the `/permission` command
- `handlePermissionModeCommand(args, ctx)` — Handle the `/permission-mode` command
- `handleSessionStart(ctx)` — Called on session start
- `handleToolCall(event, ctx)` — Called on every tool call, returns `{ block: true; reason }` or `undefined`
- `createInitialState()` — Create a fresh permission state (loads global defaults)
- `setLevel(level, saveGlobally, ctx)` — Set the permission level
- `setMode(mode, saveGlobally)` — Set the permission mode

### `core/interfaces.ts` — Other Interface Definitions

- `PermissionConfig` — Overrides (per-level glob patterns), prefix mappings, tools (per-tool permission levels), mcp (per-MCP permission levels), quietStartup, forceUI, systemNotifications
- `PermissionOverrides` — Per-level override arrays: `{ minimal?, low?, medium?, high?, dangerous? }`
- `PermissionPrefixMapping` — `{ from: string, to: string }` for normalizing version-manager commands
- `ToolPermissionConfig` — Per-level tool name assignments: `{ minimal?, low?, medium?, high?, dangerous? }`
- `McpPermissionConfig` — Per-level MCP tool/mode name assignments: `{ minimal?, low?, medium?, high?, dangerous? }`
- `Classification` — `{ level: PermissionLevel, dangerous: boolean }`
- `PermissionState` — `currentLevel`, `isSessionOnly`, `permissionMode`, `isModeSessionOnly`
- `WriteToolCallOptions` — Options passed to write tool handler (state, toolName, filePath, ctx)
- `PermissionRequestOptions` — Options for permission request flow (state, message, requiredLevel, details, notifyTitle, envVarHint, ctx)

## Design Notes

- Uses [`shell-quote`](https://npmjs.com/package/shell-quote) for command parsing
- Caches compiled regex patterns (max 500 entries) and config (5s TTL) for performance
- Handles tmux terminal detection for appropriate notifications
- Supports both interactive and print mode (`-p`) execution via the **strategy pattern**
- Atomic file writes for settings persistence (write to `.tmp`, then `rename`)
- Settings validation limits overrides to 100 patterns per level, tool/MCP entries to 100 per level, and 50 prefix mappings total
- Unknown tools (not in read whitelist) are blocked with HIGH permission requirement
- Interactive and non-interactive behaviors are separated into `UIPermissionStrategy` and `NoUIPermissionStrategy`, sharing `BasePermissionStrategy` for the common algorithm
- Shared utilities live in `strategies/internal/` — internal to the strategy module, not a public API

## Blocked Message Format

When a command is blocked, the agent receives:

```
<displayed command>
Blocked by permission (<level>). Allowed at this level: <short description>
User can re-run with: PI_PERMISSION_LEVEL=<required> <env_var_hint>
```

The short description comes from `LEVEL_INFO[level].desc`:
| Level | Description |
|-------|-------------|
| minimal | Read-only |
| low | File ops only |
| medium | Dev operations |
| high | Full operations |
| bypassed | All checks disabled |
