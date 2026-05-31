# Architecture

## Major Files

```
src/
├── index.ts                # Extension entry point — registers commands, completions & event hooks
├── autocomplete.ts         # getPermissionCompletions, getPermissionModeCompletions (tab completion)
│
├── shared/                 # Shared logic (single source of truth)
│   ├── commands.ts         # handleConfigSubcommand (shared by UI & no-UI)
│   ├── events.ts           # initializeSessionState
│   └── tools.ts            # MCP constants, parseMcpInput, isKnownReadTool
│
├── no-ui/                  # Non-interactive handlers (print mode, CI)
│   ├── commands.ts         # handlePermissionCommand, handlePermissionModeCommand
│   ├── events.ts           # handleSessionStart, handleToolCall
│   └── handlers.ts         # handleDangerousCommand, requestPermission, handleBashToolCall, etc.
│
├── ui/                     # Interactive handlers (interactive mode)
│   ├── commands.ts         # handlePermissionCommand, handlePermissionModeCommand
│   ├── events.ts           # handleSessionStart, handleToolCall (dispatcher)
│   ├── handlers.ts         # handleDangerousCommand, requestPermission, handleBashToolCall, etc.
│   ├── settings.ts         # createSettingsList — interactive TUI for quietStartup/forceUI toggles
│   ├── state.ts            # createInitialState, setLevel, setMode
│   └── ui.ts               # hasInteractiveUI, notifySystem, isQuietMode, getStatusText, terminal detection
│
└── core/
    ├── classifier.ts       # classifyCommand(), parseCommand(), dangerous command detection
    ├── constants.ts        # Shell trick patterns, redirection ops, command separators
    ├── manager.ts          # SettingsManager class (file I/O, atomic writes, validation)
    ├── settings.ts         # Global settings persistence (delegates to SettingsManager)
    ├── tools.ts            # Config caching, glob→regex conversion, override checking, prefix mappings
    ├── interfaces.ts       # PermissionConfig, PermissionOverrides, PermissionPrefixMapping, ToolPermissionConfig, McpPermissionConfig, Classification, PermissionState, tool call options
    ├── types.ts            # PermissionLevel, PermissionMode, LEVELS, LEVEL_INFO, PERMISSION_MODES
    └── levels/
        ├── index.ts        # `getCommandName()` helper + re-exports `isMinimalLevel`, `isMediumLevel`, `isHighLevel`
        ├── minimal.ts      # Minimal level classification (read-only commands)
        ├── medium.ts       # Medium level classification (build/install/test)
        └── high.ts         # High level classification (network/deployment/shell execution)

      Note: No `low.ts` classifier exists. `low` is used only as an override target and as the minimum floor for output-redirection and write/edit tool operations.

tests/
├── permission.test.ts           # Command classification tests
├── permission-prompt.test.ts    # UI prompt behavior tests
└── interactive-ui.test.ts       # hasInteractiveUI, isQuietMode, notifySystem, terminal detection, systemNotifications
```

## Directory Structure

### `shared/` — Shared Logic

Functions used by both interactive and non-interactive handlers:

- `commands.ts` — `handleConfigSubcommand()` (config show/reset/help)
- `events.ts` — `initializeSessionState()` (loads env var or global settings)
- `tools.ts` — MCP tool detection and read-only tool check:
  - `isKnownReadTool()` — Checks if a tool name is in the read-only whitelist (`read`, `ls`, `grep`, `find`)
  - `parseMcpInput()` — Parses MCP tool call input to determine target tool, mode, and required permission level
  - `READONLY_MCP_TOOLS` — Set of ~45 MCP tools that only require `low` permission (GitHub read, Atlassian read, etc.)
  - `MCP_READ_ONLY_MODES` — Modes (`search`, `describe`, `list`, `status`, `connect`) that only require `minimal` permission
  - Logic: modes in `MCP_READ_ONLY_MODES` → `minimal`; known read tools → `low`; everything else → `medium`

### `ui/` — Interactive Handlers

Used when `hasInteractiveUI(ctx)` returns `true` (interactive mode):

- `handlers.ts` — `handleBashToolCall()`, `handleMcpToolCall()`, `handleWriteToolCall()`, `handleDangerousCommand()`, `requestPermission()`
- `commands.ts` — `handlePermissionCommand()`, `handlePermissionModeCommand()` (with interactive select prompts for level/mode scope)
- `events.ts` — `handleSessionStart()` (initializes state, sets status bar, shows notifications), `handleToolCall()` (dispatches to specific handlers)
- `settings.ts` — `createSettingsList()` — renders an interactive TUI `SettingsList` for toggling `quietStartup`, `forceUI`, and `systemNotifications`
- `state.ts` — `createInitialState()`, `setLevel()`, `setMode()`
- `ui.ts` — `hasInteractiveUI()` (detects interactive context), `notifySystem()` (desktop notifications — respects `systemNotifications` setting: `"off"`/`"on"`/`"unfocused"`/`"persistent"`), `isQuietMode()`, `getStatusText()`, terminal bundle ID detection (macOS: Ghostty, iTerm2, Kitty, Alacritty, Warp, Apple Terminal, VS Code), tmux awareness

### `no-ui/` — Non-Interactive Handlers

Used when `hasInteractiveUI(ctx)` returns `false` (print mode, CI):

- `handlers.ts` — `handleBashToolCall()`, `handleMcpToolCall()`, `handleWriteToolCall()`, `handleDangerousCommand()`, `requestPermission()` — same signatures as `ui/` counterparts but always return block results with helpful error messages (no prompts)
- `commands.ts` — `handlePermissionCommand()`, `handlePermissionModeCommand()` — without interactive select prompts; setting a level always saves session-only (no global persistence)
- `events.ts` — `handleSessionStart()` (calls `initializeSessionState` only, no notifications or status bar), `handleToolCall()` (dispatches to no-UI handlers)

### `index.ts` — Entry Point

Registers commands with tab completions and event hooks. Creates a shared `state` via `createInitialState()` and uses a `dispatch` helper to route every call to the `ui/` or `no-ui/` handler pair:

```ts
const state = createInitialState();

const dispatch = <T>(ctx: ExtensionContext, ui: () => T, noUi: () => T): T =>
  hasInteractiveUI(ctx) ? ui() : noUi();

pi.registerCommand("permission", {
  description: "View or change permission level",
  getArgumentCompletions: getPermissionCompletions,
  handler: (args, ctx) =>
    dispatch(ctx,
      () => handlePermissionCommand(state, args, ctx),
      () => handlePermissionCommand_noUI(state, args, ctx),
    ),
});
```

Registered commands: `permission`, `permission-mode` (both with `getArgumentCompletions` for tab completion)
Registered events: `session_start`, `tool_call`

## Permission-Core → Split into `core/`

The original monolithic `permission-core.ts` was refactored into focused modules:

### `core/classifier.ts`

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

### `core/manager.ts`

`SettingsManager` class — file I/O, atomic writes, and config validation:
- `load()` — Reads and parses `settings.json` (returns `{}` on failure)
- `save(settings)` — Atomic write: writes to `.tmp` file, then renames
- `validate(raw)` — Sanitizes `PermissionConfig`: strips invalid entries, caps overrides at 100 per level, tool/MCP entries at 100 per level, and prefix mappings at 50
- `validateOverrides(raw)` — Filters patterns to valid non-empty strings per level
- `validateToolMcpConfig(raw, fieldName)` — Filters tool/MCP entries to valid non-empty strings per level (100 cap)
- `validatePrefixMappings(raw)` — Filters mappings to valid `{from, to}` objects

### `core/tools.ts`

Configuration utilities:
- `getCachedConfig()` — TTL-based cache (5 seconds) for permission config
- `globToRegex()` — Converts glob patterns to case-insensitive regex
- `matchesAnyPattern()` — Checks if a command matches any pattern in a level
- `applyPrefixMappings()` — Normalizes version-manager commands (`fvm flutter` → `flutter`)
- `checkOverrides()` — Checks overrides from most restrictive to least (dangerous → high → medium → low → minimal)
- `invalidateConfigCache()` — Clears config and regex caches

### `core/constants.ts`

Static classification data:
- `SHELL_EXECUTION_COMMANDS` — `eval`, `exec`, `source`, `.`, `env`, `command`, `builtin`, `time`, `nice`, `nohup`, `timeout`, `watch`, `strace` (note: `xargs` is handled separately in `minimal.ts` with conditional logic)
- `SHELL_TRICK_PATTERNS` — `$(cmd)`, backticks, `<(cmd)`, `>(cmd)`
- `OUTPUT_REDIRECTION_OPS` — `>`, `>>`, `>|`, `&>`, `&>>`
- `ALL_REDIRECTION_OPS` — Includes input redirection `<`, `<&`, `<>`
- `COMMAND_SEPARATORS` — `|`, `&&`, `||`, `;`, `&`
- `SAFE_REDIRECTION_TARGETS` — `/dev/null`, `/dev/stdout`, `/dev/stderr`, `/dev/fd/1`, `/dev/fd/2`

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

### `classifier.ts` — Classification Pipeline

The classifier runs in this order:
1. **Prefix normalization** — `fvm flutter build` → `flutter build`
2. **Shell trick detection** — `$(cmd)`, backticks, `<(cmd)`, `>(cmd)`, `${VAR:-$(cmd)}` → always **high**
3. **Override check** — User-configured patterns (dangerous → high → medium → low → minimal, most restrictive wins)
4. **Output redirection** — `>`, `>>` to non-special files → minimum **low** (note: no `isLowLevel()` classifier exists; "low" is set only as a floor for file-writing commands)
5. **Segment classification** — Each pipe/separator segment is classified individually:
   - `SHELL_EXECUTION_COMMANDS` (eval, exec, source, `.`, env, command, builtin, time, nice, nohup, timeout, watch, strace) → **high**
   - `isDangerousCommand()` (sudo, rm -rf, chmod 777, dd of=/dev/*, fdisk, parted, format, mkfs*, shutdown, reboot, halt, poweroff, init, fork bomb) → **high + dangerous flag**
   - `isMinimalLevel()` → **minimal**
   - `isMediumLevel()` → **medium**
   - `isHighLevel()` → **high**
   - Default fallback → **high**
6. **Pipeline trick detection** — If a pipe leads to `bash`, `sh`, `zsh`, `node`, `python`, `python3`, `ruby`, or `perl` → **high**
7. **Max level** — The highest level across all segments wins

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
- `LEVELS` / `PERMISSION_MODES` — Ordered arrays
- `LEVEL_INDEX` — Numeric ordering (minimal: 0 → bypassed: 4)
- `LEVEL_INFO` — Label and short description per level
- `PERMISSION_MODE_INFO` — Label and description per mode
- `LEVEL_INFO` also provides the short descriptions used in blocked messages (no separate `LEVEL_ALLOWED_DESC` constant)
- `Notification` — `"off" | "unfocused" | "on" | "persistent"` — Controls OS notification behavior:
  - `"off"` — Fully disabled, no notifications shown
  - `"on"` — Always shown regardless of focus
  - `"unfocused"` — Only shown when the terminal is not focused (default)
  - `"persistent"` — Always shown with critical/persistent priority (Linux: `-u critical` flag)

### `core/interfaces.ts`

Interface definitions:
- `PermissionConfig` — Overrides (per-level glob patterns), prefix mappings, tools (per-tool permission levels), mcp (per-MCP permission levels), quietStartup, forceUI, systemNotifications
- `PermissionOverrides` — Per-level override arrays: `{ minimal?, low?, medium?, high?, dangerous? }`
- `PermissionPrefixMapping` — `{ from: string, to: string }` for normalizing version-manager commands
- `ToolPermissionConfig` — Per-level tool name assignments: `{ minimal?, low?, medium?, high?, dangerous? }`
- `McpPermissionConfig` — Per-level MCP tool/mode name assignments: `{ minimal?, low?, medium?, high?, dangerous? }`
- `Classification` — `{ level, dangerous }`
- `PermissionState` — `currentLevel`, `isSessionOnly`, `permissionMode`, `isModeSessionOnly`
- `WriteToolCallOptions` — Options passed to write tool handler (state, toolName, filePath, ctx)
- `PermissionRequestOptions` — Options for permission request flow (state, message, requiredLevel, details, notifyTitle, envVarHint, ctx)

## Design Notes

- Uses [`shell-quote`](https://npmjs.com/package/shell-quote) for command parsing
- Caches compiled regex patterns (max 500 entries) and config (5s TTL) for performance
- Handles tmux terminal detection for appropriate notifications
- Supports both interactive and print mode (`-p`) execution
- Atomic file writes for settings persistence (write to `.tmp`, then `rename`)
- Settings validation limits overrides to 100 patterns per level, tool/MCP entries to 100 per level, and 50 prefix mappings total
- Unknown tools (not in read whitelist) are blocked with HIGH permission requirement
- Interactive and non-interactive handlers are fully separated into `ui/` and `no-ui/` directories
- Shared logic lives in `shared/` to avoid duplication between the two modes

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
