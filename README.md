# pi-permission-layers

A [Pi Coding Agent](https://pi.dev/) extension that implements a layered permission control extension to protect users from unintended operations.

> **Note**: This project is a refactored fork. See the [Acknowledgements](#acknowledgements) section for lineage and credits. The goal of this fork is to have a more maintainable codebase while preserving the same core idea, and to adjust a few things deemed useful to me.

## What This Project Is

A TypeScript extension that adds permission-based command filtering to the pi coding agent. It classifies shell commands into 5 security levels and enforces them at runtime, with configurable overrides and two permission modes (`ask` / `block`).

## Levels

| Level | Description | Allowed Operations |
|-------|-------------|-------------------|
| `minimal` | Read-only (default) | `ls`, `grep`, `cat`, `git status/diff/log`, `npm list`, etc. |
| `low` | File operations | Create/edit files, `mkdir`, `cp`, `mv` |
| `medium` | Development operations | `npm install`, `npm build/test`, `git commit/pull`, builds |
| `high` | Full operations | `git push`, deployments, `curl`, `docker push`, `kubectl` |
| `bypassed` | All checks disabled | Everything (dangerous — CI/containers only) |

**Dangerous commands** (always prompt, even at `high`): `sudo`, `rm -rf`, `chmod 777`, `dd`, `mkfs`, `shutdown`/`reboot`

## Key Features

- **Command classification** — Automatically classifies shell commands by required permission level
- **Dangerous command detection** — Special handling for `rm -rf`, `sudo`, `chmod 777`, etc.
- **MCP tool permissioning** — Controls access to MCP tools (search, connect, etc.)
- **Shell trick detection** — Prevents bypass via `$(cmd)`, backticks, process substitution, `eval`, etc.
- **Configurable overrides** — Users can customize classification in `~/.pi/agent/settings.json`
- **Two permission modes** — `ask` (prompt) or `block` (deny without asking)
- **Prefix mappings** — Normalize version-manager commands (`fvm flutter`, `nvm exec`, etc.) to their base tools
- **Terminal awareness** — Detects tmux/screen for appropriate notifications

## Usage

### Interactive Mode

```bash
# Extension loads automatically from ~/.pi/agent/extensions/ or .pi/extensions/
pi
```

**Commands:**
- `/permission` — Show selector to change level
- `/permission medium` — Set level directly (asks session/global)
- `/permission-mode` — Switch between `ask`/`block` when permission is required
- `/permission-mode block` — Block instead of prompting
- `/permission config show` — Display current configuration
- `/permission config reset` — Reset to default (empty)

**When a command needs higher permission:**
```
🔒 Requires Medium: npm install lodash

  [Allow once]           → Execute this command only
  [Allow all (Medium)]   → Update global settings and execute
  [Cancel]               → Don't execute
```

If permission mode is set to `block`, commands requiring higher permission are blocked without prompting. Use `/permission-mode ask` to restore prompts.

### Print Mode

Permission mode is ignored in print mode; insufficient permissions always block.

```bash
# Set level via environment variable
PI_PERMISSION_LEVEL=medium pi -p "install deps and run tests"

# Bypass all permission checks (CI/containers — dangerous!)
PI_PERMISSION_LEVEL=bypassed pi -p "do anything"
```

**If permission is insufficient:**
The command is blocked but execution continues. The agent receives:
```
Blocked by permission (minimal). Command: npm install lodash
Allowed at this level: read-only (cat, ls, grep, git status/diff/log, npm list, version checks)
User can re-run with: PI_PERMISSION_LEVEL=medium pi -p "..."
```

The agent can then work around the limitation or inform the user.

## Environment Variables

| Variable | Values | Description |
|----------|--------|-------------|
| `PI_PERMISSION_LEVEL` | `minimal`, `low`, `medium`, `high`, `bypassed` | Set permission level |

## Settings

Global settings stored in `~/.pi/agent/settings.json`:

```json
{
  "permissionLevel": "medium",
  "permissionMode": "ask",
  "permissionConfig": {
    "overrides": {
      "minimal": ["tmux list-*", "tmux show-*"],
      "medium": ["tmux attach*", "tmux new*"],
      "high": ["rm -rf *"],
      "dangerous": ["dd if=* of=/dev/*"]
    },
    "prefixMappings": [
      { "from": "fvm flutter", "to": "flutter" },
      { "from": "nvm exec", "to": "" },
      { "from": "rbenv exec", "to": "" },
      { "from": "pyenv exec", "to": "" }
    ],
    "quietStartup": true
  }
}
```

`permissionMode` accepts `ask` (prompt) or `block` (deny without prompting).

### Override Patterns

Glob patterns matched against the full command:
- `*` matches any characters
- `?` matches single character
- Patterns are case-insensitive

Override priority (highest to lowest):
1. `dangerous` — Always prompt, even at high level
2. `high` — Require high permission
3. `medium` — Require medium permission
4. `low` — Require low permission
5. `minimal` — Allow at minimal (read-only)

> **Note:** When a command matches patterns in multiple levels, the **most restrictive** level wins. Avoid overlapping patterns across levels. For example, don't put `tmux *` in medium if you want `tmux list-*` to be minimal.

**Examples:**
```json
{
  "overrides": {
    "minimal": [
      "tmux list-*",      // tmux list-sessions, tmux list-windows, etc.
      "tmux show-*",      // tmux show-options, tmux show-messages, etc.
      "screen -list"      // List screen sessions
    ],
    "medium": [
      "tmux attach*",     // Attach to sessions
      "tmux new*",        // Create new sessions
      "screen -r *"       // Reattach to screen
    ],
    "high": [
      "rm -rf *",         // Force rm with any arguments
      "dd of=/dev/*"      // dd writing to any device
    ],
    "dangerous": [
      "dd if=* of=/dev/*" // dd writing to device from any source
    ]
  }
}
```

### Prefix Mappings

Normalize version manager commands to their base tools:
- `fvm flutter build` → treated as `flutter build` (classified normally)
- `nvm exec node` → treated as `node` (classified normally)
- `rbenv exec ruby` → treated as `ruby` (classified normally)

**How it works:**
1. Commands are checked against prefix mappings first
2. If a prefix matches, it's replaced with the mapped value
3. The normalized command is then classified

## Command Classification

The principle: **building/installing is MEDIUM, running code is HIGH**.

### Minimal Level (Read-only)
- File reading: `cat`, `less`, `head`, `tail`, `bat`
- Directory: `ls`, `tree`, `pwd`, `find`, `fd`
- Search: `grep`, `rg`, `ag`
- Info: `echo`, `whoami`, `date`, `uname`, `ps`, `env`
- Git read: `git status`, `git log`, `git diff`, `git show`, `git branch`, `git fetch`
- Package info: `npm list`, `pip list`, `cargo tree`

### Medium Level (Build/Install/Test — Reversible)
- **Node.js**: `npm install/ci/test/build`, `yarn install/add/build/test`, `pnpm`, `bun`
- **npm run** (safe scripts only): `build`, `test`, `lint`, `format`, `check`, `typecheck`
- **Python**: `pip install`, `poetry install/build`, `pytest`
- **Rust**: `cargo build/test/check/clippy/fmt` (NOT `cargo run`)
- **Go**: `go build/test/get/mod` (NOT `go run`)
- **Ruby**: `gem install`, `bundle install`
- **CocoaPods**: `pod install`, `pod update`, `pod repo update`
- **PHP**: `composer install`
- **Java**: `mvn compile/test`, `gradle build/test`
- **.NET**: `dotnet build/test`
- **Git local**: `git add`, `git commit`, `git pull`, `git checkout`, `git merge`, `git clone`
- **Build tools**: `make`, `cmake`, `ninja`
- **Linters** (static analysis — only check/report, no execution):
  - **JS/TS**: `eslint`, `prettier`, `tsc --noEmit`, `tslint`, `standard`, `xo`
  - **Python**: `pylint`, `flake8`, `black`, `mypy`, `pyright`, `ruff`, `pyflakes`, `bandit`
  - **Rust**: `cargo clippy`, `cargo fmt`, `rustfmt`
  - **Go**: `gofmt`, `go vet`, `golangci-lint`, `golint`, `staticcheck`, `errcheck`, `misspell`
  - **Ruby**: `rubocop`, `standardrb`, `reek`, `brakeman`
  - **Swift**: `swiftlint`, `swiftformat`
  - **Kotlin**: `ktlint`, `detekt`
  - **Dart/Flutter**: `dart analyze`, `flutter analyze`, `dart format`, `flutter format`
  - **C/C++**: `clang-tidy`, `clang-format`, `cppcheck`
  - **Java**: `checkstyle`, `pmd`, `spotbugs`, `error-prone`
  - **C#**: `dotnet format`, `dotnet build -t:RunCodeAnalysis`
  - **PHP**: `phpcs`, `phpmd`, `phpstan`, `psalm`, `php-cs-fixer`
  - **Lua**: `luacheck`
  - **Shell**: `shellcheck`
  - **IaC**: `checkov`, `tflint`, `terraform validate`
  - **Protobuf**: `buf lint`, `protoc --lint`
  - **SQL**: `sqlfluff`
  - **YAML**: `yamllint`
  - **Markdown**: `markdownlint`
  - **HTML/Django**: `djlint`, `djhtml`
  - **Git**: `commitlint`
- **File ops**: `mkdir`, `touch`, `cp`, `mv`

### High Level (Runs Code / Irreversible)
- **Running code**: `python script.py`, `node app.js`, `cargo run`, `go run`
- **npm run** (unsafe scripts): `dev`, `start`, `serve`, `watch`, `preview`
- **Package executors**: `npx`, `bunx`, `pnpx` (run arbitrary packages)
- **Git remote**: `git push`, `git push --force`
- **Git irreversible**: `git reset --hard`, `git clean`, `git restore`
- **Network**: `curl`, `wget` (can't verify trusted endpoints)
- **Deployment**: `docker push`, `kubectl`, `helm`, `terraform`
- **Remote access**: `ssh`, `scp`, `rsync`
- **Shell execution**: `eval`, `exec`, `source`, `xargs`

### Dangerous (Always Prompt)
- `sudo` (any form)
- `rm` with `-r` AND `-f` flags
- `chmod 777` or `a+rwx`
- `dd of=/dev/...`
- `mkfs`, `mkfs.ext4`, `fdisk`, `parted`
- `shutdown`, `reboot`, `halt`, `poweroff`

## Shell Trick Detection

Commands containing these patterns require HIGH permission:
- Command substitution: `$(cmd)`, `` `cmd` ``
- Process substitution: `<(cmd)`, `>(cmd)`
- Dangerous expansions: `${VAR:-$(cmd)}` (nested command substitution)

## Testing

Run tests with:

```bash
npm test
```

Or individually:

```bash
npx tsx tests/permission.test.ts
npx tsx tests/permission-prompt.test.ts
```

### Test Structure

- **permission.test.ts** — Tests `classifyCommand()` directly
  - Covers all 5 permission levels
  - Tests command parsing, pipelines, redirections
  - Tests shell tricks (`$()`, backticks, `eval`)
  - Tests config overrides and prefix mappings

- **permission-prompt.test.ts** — Tests UI handler functions
  - Tests prompt messages and options
  - Tests Allow/Cancel/Block behavior
  - Tests block mode vs ask mode

> **New features MUST be covered by tests.** All command classification changes require test updates. Run `npm test` before committing.

## Building

```bash
npm run build    # TypeScript compilation
npm test         # Run tests
```

Output goes to `dist/`.

## Architecture

### Major Files

```
src/
├── permission-core.ts      # Core logic: command classification, config, settings
├── permission.ts           # Extension entry point, handlers, UI prompts

tests/
├── permission.test.ts      # Command classification tests (~1400 lines)
├── permission-prompt.test.ts  # UI prompt behavior tests
```

### permission-core.ts

Pure functions for:
- `classifyCommand()` — Determines permission level for any shell command
- `parseCommand()` — Shell parsing with operator detection
- Config/cache management functions

### permission.ts

Extension hooks and handlers:
- `handleBashToolCall()` — Bash command permission checks
- `handleWriteToolCall()` — File write/edit permission checks
- `handleMcpToolCall()` — MCP tool call permission checks
- `handlePermissionCommand()` — `/permission` slash command
- `handlePermissionModeCommand()` — `/permission-mode` slash command

### Design Notes

- Uses [`shell-quote`](https://www.npmjs.com/package/shell-quote) for command parsing
- Caches compiled regex patterns for performance
- Handles tmux/screen terminal detection for notifications
- Supports both interactive and print mode (`-p`) execution

## Installation

Install the package and enable extensions:
```bash
pi install npm:pi-permission-layers
pi config
```

Dependencies are installed automatically during `pi install`.

# Acknowledgements

This project is a fork of:

1. **[pi-permission](https://github.com/SecKatie/pi-permission)** — the immediate parent, which added MCP tool permissioning and expanded classification (archived project).
2. **[permission-pi](https://github.com/prateekmedia/pi-hooks/tree/main/permission)** — the original extension that established the layered permission control concept.
