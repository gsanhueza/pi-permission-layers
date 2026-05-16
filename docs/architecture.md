# Architecture

## Major Files

```
src/
├── index.ts                # Extension entry point — registers commands & event hooks
│
├── shared/                 # Shared logic (single source of truth)
│   ├── commands.ts         # handleConfigSubcommand (shared by UI & no-UI)
│   ├── events.ts           # initializeSessionState
│   ├── tools.ts            # MCP constants, parseMcpInput, isKnownReadTool, truncate
│   └── ui.ts               # hasInteractiveUI, notifySystem, isQuietMode, getStatusText
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
│   ├── state.ts            # createInitialState, setLevel, setMode
│   └── ui.ts               # re-exports from shared/ui.ts
│
└── core/
    ├── classifier.ts       # classifyCommand(), parseCommand(), dangerous command detection
    ├── constants.ts        # Shell trick patterns, redirection ops, command separators
    ├── settings.ts         # Global settings persistence (load/save from ~/.pi/agent/settings.json)
    ├── tools.ts            # Config caching, glob→regex conversion, override checking, prefix mappings
    ├── types.ts            # Type definitions, LEVELS, LEVEL_INFO, PERMISSION_MODES
    └── levels/
        ├── index.ts        # getCommandName helper
        ├── minimal.ts      # Minimal level classification (read-only commands)
        ├── medium.ts       # Medium level classification (build/install/test)
        └── high.ts         # High level classification (network/deployment/shell execution)

tests/
├── permission.test.ts      # Command classification tests (~1470 lines)
└── permission-prompt.test.ts  # UI prompt behavior tests
```

## Directory Structure

### `shared/` — Shared Logic

Functions used by both interactive and non-interactive handlers:

- `commands.ts` — `handleConfigSubcommand()` (config show/reset/help)
- `events.ts` — `initializeSessionState()` (loads env var or global settings)
- `tools.ts` — MCP tool detection (`parseMcpInput()`), read-only tool check (`isKnownReadTool()`), `truncate()`
- `ui.ts` — `hasInteractiveUI()`, `notifySystem()`, `isQuietMode()`, `getStatusText()`

### `ui/` — Interactive Handlers

Used when `hasInteractiveUI(ctx)` returns `true` (interactive mode):

- `handlers.ts` — `handleBashToolCall()`, `handleMcpToolCall()`, `handleWriteToolCall()`, `handleDangerousCommand()`, `requestPermission()`
- `commands.ts` — `handlePermissionCommand()`, `handlePermissionModeCommand()` (with interactive select prompts)
- `events.ts` — `handleSessionStart()` (shows status bar, notifications), `handleToolCall()` (dispatcher)
- `state.ts` — `createInitialState()`, `setLevel()`, `setMode()`
- `ui.ts` — Re-exports from `shared/ui.ts`

### `no-ui/` — Non-Interactive Handlers

Used when `hasInteractiveUI(ctx)` returns `false` (print mode, CI):

- `handlers.ts` — Same handlers as `ui/handlers.ts` but return block results with helpful error messages
- `commands.ts` — Same commands as `ui/commands.ts` but without interactive prompts
- `events.ts` — `handleSessionStart()` (no notifications), `handleToolCall()` (no-UI handler)

### `index.ts` — Entry Point

Registers commands and event hooks. Dispatches to `ui/` or `no-ui/` based on `hasInteractiveUI(ctx)`:

```ts
if (hasInteractiveUI(ctx)) {
  return handlePermissionCommand_UI(state, args, ctx);
}
return handlePermissionCommand_noUI(state, args, ctx);
```

## Permission-Core → Split into `core/`

The original monolithic `permission-core.ts` was refactored into focused modules:

### `classifier.ts`

Pure functions for command classification:
- `classifyCommand()` — Determines permission level for any shell command
- `parseCommand()` — Shell parsing with operator detection (pipes, redirects, separators)
- `detectShellTricks()` — Detects `$(cmd)`, backticks, process substitution, dangerous brace expansions
- `isDangerousCommand()` — Detects `sudo`, `rm -rf`, `chmod 777`, `dd of=/dev/*`, `mkfs`, `shutdown`, fork bombs

### `core/settings.ts`

Settings persistence:
- `loadGlobalPermission()` / `saveGlobalPermission()` — `permissionLevel` in settings.json
- `loadGlobalPermissionMode()` / `saveGlobalPermissionMode()` — `permissionMode` in settings.json
- `loadPermissionConfig()` / `savePermissionConfig()` — `permissionConfig` overrides & prefix mappings
- Atomic file writes (write to `.tmp`, then `rename`)

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
- `SHELL_EXECUTION_COMMANDS` — `eval`, `exec`, `source`, `.`, `env`, `command`, `builtin`, `time`, `nice`, `nohup`, `timeout`, `watch`, `strace`
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
4. **Output redirection** — `>`, `>>` to non-special files → minimum **low**
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

Type definitions and constants:
- `PermissionLevel` — `"minimal" | "low" | "medium" | "high" | "bypassed"`
- `PermissionMode` — `"ask" | "block"`
- `LEVELS` / `PERMISSION_MODES` — Ordered arrays
- `LEVEL_INDEX` — Numeric ordering (minimal: 0 → bypassed: 4)
- `LEVEL_INFO` — Label and short description per level
- `PERMISSION_MODE_INFO` — Label and description per mode
- `LEVEL_ALLOWED_DESC` — Human-readable "allowed at this level" descriptions
- `PermissionConfig` — Overrides, prefix mappings, quietStartup
- `Classification` — `{ level, dangerous }`
- `PermissionState` — Current level, mode, session-only flags

## Design Notes

- Uses [`shell-quote`](https://npmjs.com/package/shell-quote) for command parsing
- Caches compiled regex patterns (max 500 entries) and config (5s TTL) for performance
- Handles tmux terminal detection for appropriate notifications
- Supports both interactive and print mode (`-p`) execution
- Atomic file writes for settings persistence (write to `.tmp`, then `rename`)
- Settings validation limits overrides to 100 patterns per level and 50 prefix mappings total
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
