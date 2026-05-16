# pi-permission-layers

A [Pi Coding Agent](https://pi.dev/) extension that implements a layered permission control extension to protect users from unintended operations. It classifies shell commands into 5 security levels and enforces them at runtime, with configurable overrides and two permission modes (`ask` / `block`).

> **Note**: This project is a refactored fork. See the [Acknowledgements](#acknowledgements) section for lineage and credits. The goal of this fork is to have a more maintainable codebase while preserving the same core idea, and to adjust a few things deemed useful to me.

## Key Features

- **Command classification** — Automatically classifies shell commands by required permission level
- **Dangerous command detection** — Special handling for `rm -rf`, `sudo`, `chmod 777`, etc.
- **MCP tool permissioning** — Controls access to MCP tools (search, connect, etc.)
- **Shell trick detection** — Prevents bypass via `$(cmd)`, backticks, process substitution, `eval`, etc.
- **Configurable overrides** — Users can customize classification in `~/.pi/agent/settings.json`
- **Two permission modes** — `ask` (prompt) or `block` (deny without asking)
- **Prefix mappings** — Normalize version-manager commands (`fvm flutter`, `nvm exec`, etc.) to their base tools
- **Terminal awareness** — Detects tmux/screen for appropriate notifications

## Levels

| Level | Description | Allowed Operations |
|-------|-------------|-------------------|
| `minimal` | Read-only (default) | `cat`, `ls`, `grep`, `git status/log/diff`, `npm list`, etc. |
| `low` | File operations | Create/edit files, `mkdir`, `cp`, `mv`, output redirection |
| `medium` | Development operations | `npm install`, builds, tests, `git commit/pull`, linters, package managers |
| `high` | Full operations | `git push`, deployments, `curl`, `docker push`, shell execution (`eval`, `exec`, `source`, `env`, etc.) |
| `bypassed` | All checks disabled | Everything (dangerous — CI/containers only) |

**Dangerous commands** (always prompt, even at `high`): `sudo`, `rm -rf`, `chmod 777`, `dd of=/dev/*`, `mkfs*`, `fdisk`, `parted`, `format`, `shutdown`, `reboot`, `halt`, `poweroff`, `init`, fork bombs

**Shell tricks** (always classified as `high`): `$(cmd)`, backticks, `<(cmd)`, `>(cmd)`, `${VAR:-$(cmd)}`

See [docs/command-classification.md](docs/command-classification.md) for the complete classification reference.

## Installation

This package is a Pi extension. Install it with

```bash
npm install pi-permission-layers
```

or

```bash
pi install https://github.com/gsanhueza/pi-permission-layers
```

## Usage

### Interactive Mode

Interactive mode enables the usage of the following commands:

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
| `PI_QUIET` | `1`, `true`, `yes` | Suppress startup notifications |

## Settings

Global settings are stored in `~/.pi/agent/settings.json`:

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

Glob patterns are matched against the full command:
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

## Testing

Run tests with:

```bash
npm run test
```

### Test Structure

- **permission.test.ts** — Tests `classifyCommand()` directly
  - Covers all 5 permission levels
  - Tests command parsing, pipelines, redirections
  - Tests shell tricks (`$()`, backticks, `eval`)
  - Tests config overrides and prefix mappings

- **permission-prompt.test.ts** (610 lines) — Tests UI handler functions
  - Tests prompt messages and options
  - Tests Allow/Cancel/Block behavior
  - Tests block mode vs ask mode

> **New features MUST be covered by tests.** All command classification changes require test updates. Run `npm run test` before committing.

## Architecture

See [docs/architecture.md](docs/architecture.md) for a complete breakdown of the codebase structure, module responsibilities, and design decisions.

# Acknowledgements

This project is a fork of:

1. **[pi-permission](https://github.com/SecKatie/pi-permission)** — the starting point of this fork, which added MCP tool permissioning and expanded classification (archived project).
2. **[permission-pi](https://github.com/prateekmedia/pi-hooks/tree/main/permission)** — the original extension that established the layered permission control concept (the starting point of the fork above).
