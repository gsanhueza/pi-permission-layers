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
| `low` | File threshold | Output redirection (`>`, `>>`), `write`/`edit` tool calls, known read-only MCP tools |
| `medium` | Development operations | Create/edit files (`mkdir`, `cp`, `mv`, `ln`), `npm install`, builds, tests, `git commit/pull`, linters, package managers |
| `high` | Full operations | `git push`, deployments, `curl`, `docker push`, shell execution (`eval`, `exec`, `source`, `env`, etc.) |
| `bypassed` | All checks disabled | Everything (dangerous — CI/containers only) |

**Dangerous commands** (always require confirmation in interactive mode, always blocked in print mode): `sudo`, `rm -rf`, `chmod 777`, `dd of=/dev/*`, `mkfs*`, `fdisk`, `parted`, `format`, `shutdown`, `reboot`, `halt`, `poweroff`, `init`, fork bombs

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
- `/permission settings` — Interactive UI to toggle `quietStartup` / `forceUI` / `systemNotifications`

**Autocomplete:** All commands support argument autocomplete. After typing the command name, press **Space** to see available values. Nested subcommands also autocomplete — e.g. `/permission config <space>` shows `show`/`reset`.

**When a command needs higher permission:**

```
[Requires Medium]: $ npm install lodash

  Allow once                  → Execute this command once
  Allow all Medium (session)  → Update the session's permissions and execute
  Cancel                      → Don't execute
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
$ npm install lodash
Blocked by permission (minimal). Allowed at this level: Read-only
User can re-run with: PI_PERMISSION_LEVEL=medium pi -p "..."
```

**If a dangerous command is used:**
```
Dangerous command requires confirmation: sudo rm -rf /tmp/foo
User can re-run with: PI_PERMISSION_LEVEL=bypassed pi -p "..."
```

The agent can then work around the limitation or inform the user.

## Environment Variables

| Variable | Values | Description |
|----------|--------|-------------|
| `PI_PERMISSION_LEVEL` | `minimal`, `low`, `medium`, `high`, `bypassed` | Set permission level |
| `PI_QUIET` | `1`, `true`, `yes` | Suppress startup notifications |
| `PI_FORCEUI` | `1`, `true`, `yes` | Force interactive UI mode |

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
    "tools": {
      "minimal": ["read", "ls", "grep", "find"],
      "low": ["write", "edit"]
    },
    "mcp": {
      "minimal": ["search", "describe", "list", "status", "connect"],
      "low": ["serper_search", "serper_scrape", "github_list_commits"],
      "medium": ["github_create_issue"]
    },
    "prefixMappings": [
      { "from": "fvm flutter", "to": "flutter" },
      { "from": "nvm exec", "to": "" },
      { "from": "rbenv exec", "to": "" },
      { "from": "pyenv exec", "to": "" }
    ],
    "quietStartup": true,
    "forceUI": true,
    "systemNotifications": "unfocused"
  }
}
```

`permissionMode` accepts `ask` (prompt) or `block` (deny without prompting).

### `permissionConfig` Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `overrides` | `PermissionOverrides` | `{}` | Per-level glob patterns for shell command overrides |
| `tools` | `ToolPermissionConfig` | `{}` | Per-level tool name assignments (delta model — only specify what you want to change) |
| `mcp` | `McpPermissionConfig` | `{}` | Per-level MCP tool/mode name assignments (delta model — only specify what you want to change) |
| `prefixMappings` | `PermissionPrefixMapping[]` | `[]` | Normalize version-manager commands to their base tools |
| `quietStartup` | `boolean` | `false` | Suppress the startup notification message |
| `forceUI` | `boolean` | `false` | Force interactive UI mode regardless of context (e.g., in print mode) |
| `systemNotifications` | `"off" \| "on" \| "unfocused" \| "persistent"` | `"unfocused"` | Control OS notifications (`"off"` = fully disabled, `"unfocused"` = only when terminal is not focused, `"on"` = always show, `"persistent"` = always show with critical/persistent priority) |

> **Note on Linux:** Terminal focus detection is not supported on Linux, so the `"unfocused"` option behaves the same as `"on"` (notifications are always shown).

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

> **Per-command overrides:** For compound commands (pipes, `&&`, `||`, `;`), each command is checked against overrides independently. If a command matches an override pattern, it uses the override level instead of its default classification. For example, `cd /tmp && command_a` with `overrides.low: ["command_a"]` classifies `command_a` as **low** (not high from default), and the final result is **low** since `cd /tmp` is minimal.

> **Note on the `low` level:** `low` is not a standalone command classification level (there is no `isLowLevel()` classifier). Instead, it serves as a permission threshold used for output redirections, write/edit tool calls, known read-only MCP tools, and as an override target. Commands like `mkdir`, `cp`, `mv`, `ln`, and `touch` are classified as `medium`, not `low`.

### Example: Full Config with Tools and MCP Overrides

```json
{
  "permissionConfig": {
    "overrides": {
      "minimal": ["tmux list-*", "tmux show-*"],
      "medium": ["tmux attach*", "tmux new*"]
    },
    "tools": {
      "low": ["read"]  // move read up from minimal to low
    },
    "mcp": {
      "medium": ["github_create_issue"]  // require medium for this tool
    },
    "prefixMappings": [
      { "from": "fvm flutter", "to": "flutter" }
    ]
  }
}
```

### Tool Permission Config (`tools`)

Assign permission levels to individual tool names. This uses a **delta/override model**: only specify what you want to change — unmentioned tools keep their default levels.

| Level | Default tools | Description |
|-------|---------------|-------------|
| `minimal` | `read`, `ls`, `grep`, `find` | Read-only operations |
| `low` | `write`, `edit` | File operations |
| `medium` | *(implicit)* | All other tools (blocked by default) |
| `high` | *(implicit — blocked)* | Unknown tools require high permission |
| `dangerous` | *(none by default)* | Always prompt, even at high level |

**Example:** `{ "minimal": ["read"], "low": ["grep"] }`:
- `read` → minimal (explicit override)
- `grep` → low (explicit override, moves up from default minimal)
- `ls`, `find` → minimal (defaults preserved — not mentioned in config)
- `write`, `edit` → low (defaults preserved)

> **Note:** `bash` is **ignored** in the `tools` config. Shell commands are classified through `classifyCommand()` and the `overrides` config instead.

### MCP Permission Config (`mcp`)

Assign permission levels to MCP tools and modes. MCP config supports two types of entries:
- **Mode names** (`search`, `describe`, `list`, `status`, `connect`, `call`, `action`) — match against the call's mode
- **Tool names** (`serper_search`, `github_list_commits`) — match against the specific tool

Tool name match takes precedence over mode match (more specific → more general).

| Mode | Description |
|------|-------------|
| `search` | MCP search mode |
| `describe` | MCP describe mode |
| `list` | MCP list mode (server listing) |
| `status` | MCP status mode |
| `connect` | MCP connect mode |
| `call` | MCP tool call mode (default when `tool` is specified) |
| `action` | MCP action mode |

| Level | Default entries | Description |
|-------|-----------------|-------------|
| `minimal` | `search`, `describe`, `list`, `status`, `connect` (modes) | Read-only MCP modes |
| `low` | ~45 read-only MCP tools (GitHub read, Atlassian read, etc.) | Read-only MCP tools |
| `medium` | *(implicit)* | All other MCP tools |
| `high` | *(implicit — blocked)* | Unknown MCP tools require high permission |
| `dangerous` | *(none by default)* | Always prompt, even at high level |

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

> **New features MUST be covered by tests.** All command classification changes require test updates. Run `npm run test` before committing.

## Architecture

See [docs/architecture.md](docs/architecture.md) for a complete breakdown of the codebase structure, module responsibilities, and design decisions.

## Acknowledgements

This project is a fork of:

1. **[pi-permission](https://github.com/SecKatie/pi-permission)** — the starting point of this fork, which added MCP tool permissioning and expanded classification (archived project).
2. **[permission-pi](https://github.com/prateekmedia/pi-hooks/tree/main/permission)** — the original extension that established the layered permission control concept (the starting point of the fork above).
