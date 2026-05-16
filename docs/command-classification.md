# Command Classification

The principle: **building/installing is MEDIUM, running code is HIGH**.

## Minimal Level (Read-only)

Read-only commands that don't modify files or execute code.

### File Reading
`cat`, `less`, `more`, `head`, `tail`, `bat`, `tac`

### Directory Navigation
`ls`, `tree`, `pwd`, `dir`, `vdir`, `cd`, `pushd`, `popd`, `dirs`, `fd`, `locate`

### Search
`grep`, `egrep`, `fgrep`, `rg`, `ag`, `ack`

### System Info
`echo`, `printf`, `whoami`, `id`, `date`, `cal`, `uname`, `hostname`, `uptime`, `type`, `file`, `stat`, `wc`, `du`, `df`, `free`, `ps`, `top`, `htop`, `pgrep`, `sleep`, `man`, `help`, `info`, `sort`, `uniq`, `cut`, `awk`, `sed`, `tr`, `column`, `paste`, `join`, `comm`, `diff`, `cmp`, `patch`, `test`, `[`, `[[`, `true`, `false`

### Conditional — Minimal Only Without Dangerous Flags

| Command | Condition |
|---------|-----------|
| `find` | Minimal only **without** `-exec`, `-execdir`, `-ok`, `-okdir`, `-delete` flags |
| `xargs` | Minimal only when the command it runs is in the minimal list |
| `tee` | Minimal only when writing to `/dev/null` |

### Git Read (No Args or No Non-Flag Args for Some)

| Subcommand | Restriction |
|---|---|
| `status`, `log`, `diff`, `show`, `fetch` | No restrictions |
| `branch`, `tag`, `remote` | Minimal only **without** non-flag arguments |
| `ls-files`, `ls-tree`, `cat-file`, `rev-parse`, `describe`, `shortlog`, `blame`, `annotate`, `whatchanged`, `reflog` | No restrictions |

### Package Info (Read-Only Subcommands)

| Tool | Minimal subcommands |
|------|-------------------|
| `npm` | `list`, `ls`, `info`, `view`, `outdated`, `audit`, `explain`, `why`, `search` |
| `yarn` | `list`, `info`, `why`, `outdated`, `audit` |
| `pnpm` | `list`, `ls`, `outdated`, `audit`, `why` |
| `bun` | `pm`, `ls` |
| `pip` / `pip3` | `list`, `show`, `freeze`, `check` |
| `cargo` | `tree`, `metadata`, `search`, `info` |
| `go` | `list`, `version`, `env` |
| `gem` | `list`, `info`, `search`, `query` |
| `composer` | `show`, `info`, `search`, `outdated`, `audit` |
| `dotnet` | `list`, `nuget` |
| `flutter` | `doctor`, `devices`, `config` |
| `dart` | `info` |

### Special Cases
- `--version`, `-v`, `-V` flags on any command → minimal
- `/dev/*` paths (e.g., `/dev/null`, `/dev/stdin`, `/dev/zero`) → minimal
- Single digit tokens (`0`–`9`) → minimal

---

## Low Level (File Threshold)

**Note:** There is no dedicated `isLowLevel()` command classifier. The `low` level is used as a **permission threshold** rather than a direct command classification:

- Output redirection (`>`, `>>`) to non-special files raises the minimum required level to `low`
- `write` and `edit` tool calls require `low` permission
- Known read-only MCP tools require `low` permission
- `low` can be used as an override target in `permissionConfig.overrides`

---

## Medium Level (Build/Install/Test)

### Package Managers

| Tool | Medium subcommands |
|------|-------------------|
| `npm` | `install`, `ci`, `add`, `remove`, `uninstall`, `update`, `rebuild`, `dedupe`, `prune`, `link`, `pack`, `test`, `build` |
| `yarn` | `install`, `add`, `remove`, `upgrade`, `import`, `link`, `pack`, `test`, `build` |
| `pnpm` | `install`, `add`, `remove`, `update`, `link`, `pack`, `test`, `build` |
| `bun` | `install`, `add`, `remove`, `update`, `link`, `test`, `build` |
| `pip` / `pip3` | `install` |
| `pipenv` | `install`, `update`, `sync`, `lock`, `uninstall` |
| `poetry` | `install`, `add`, `remove`, `update`, `lock`, `build` |
| `conda` | `install`, `update`, `remove`, `create` |
| `uv` | `pip`, `sync`, `lock` |
| `cargo` | `install`, `add`, `remove`, `fetch`, `update`, `build`, `test`, `check`, `clippy`, `fmt`, `doc`, `bench`, `clean` |
| `rustfmt` | any |
| `rustc` | any |
| `go` | `get`, `mod`, `build`, `test`, `generate`, `fmt`, `vet`, `clean`, `install` |
| `gem` | `install` |
| `bundle` / `bundler` | `install`, `update`, `add`, `remove`, `binstubs` |
| `pod` | `install`, `update`, `repo` |
| `composer` | `install`, `require`, `remove`, `update`, `dump-autoload` |
| `mvn` | `install`, `compile`, `test`, `package`, `clean`, `dependency`, `verify` |
| `gradle` | `build`, `test`, `clean`, `assemble`, `dependencies`, `check` |
| `dotnet` | `restore`, `add`, `build`, `test`, `clean`, `publish`, `pack`, `new` |
| `nuget` | `install` |
| `dart` | `pub`, `compile`, `test`, `analyze`, `format`, `fix` |
| `flutter` | `pub`, `build`, `test`, `analyze`, `clean`, `create`, `doctor` |
| `pub` | `get`, `upgrade`, `downgrade`, `cache`, `deps` |
| `swift` | `package`, `build`, `test` |
| `swiftc` | any |
| `mix` | `deps`, `compile`, `test`, `ecto`, `phx.gen` |
| `cabal` | `install`, `build`, `test`, `update` |
| `stack` | `install`, `build`, `test`, `setup` |
| `ghc` | any |
| `nimble` | `install` |
| `zig` | `build`, `test`, `fetch` |
| `prisma` | `generate`, `migrate`, `db`, `studio` |
| `sequelize` | `db`, `migration` |
| `typeorm` | `migration` |

### Build Tools
`make`, `cmake`, `ninja`, `meson`

### Test Runners
`pytest`, `rspec`, `phpunit`, `jest`, `mocha`, `vitest`

### npm run / yarn run / pnpm run / bun run — Safe Scripts

Safe scripts are determined by prefix or exact match:

**Exact match:** `build`, `compile`, `test`, `lint`, `format`, `fmt`, `check`, `typecheck`, `type-check`, `types`, `validate`, `verify`, `prepare`, `prepublish`, `prepublishOnly`, `prepack`, `postpack`, `clean`, `lint:fix`, `format:check`, `build:prod`, `build:dev`, `build:production`, `build:development`, `test:unit`, `test:integration`, `test:e2e`, `test:coverage`

**Prefix match (any script starting with):** `build`, `test`, `lint`, `format`, `check`, `type`

### Git Local Operations
`add`, `commit`, `pull`, `checkout`, `switch`, `branch`, `merge`, `rebase`, `cherry-pick`, `stash`, `revert`, `tag`, `rm`, `mv`, `reset` (except `reset --hard`), `clone`

### File Operations
`mkdir`, `touch`, `cp`, `mv`, `ln`

### Linters (Static Analysis — Any Subcommand)

**JS/TS:** `eslint`, `prettier`, `tsc`, `tslint`, `standard`, `xo`
**Python:** `pylint`, `flake8`, `black`, `mypy`, `pyright`, `ruff`, `pyflakes`, `bandit`
**Rust:** `cargo clippy`, `cargo fmt`, `rustfmt`
**Go:** `gofmt`, `go vet`, `golangci-lint`, `golint`, `staticcheck`, `errcheck`, `misspell`
**Ruby:** `rubocop`, `standardrb`, `reek`, `brakeman`
**Swift:** `swiftlint`, `swiftformat`
**Kotlin:** `ktlint`, `detekt`
**Dart/Flutter:** `dartanalyzer`, `dartfmt`
**C/C++:** `clang-tidy`, `clang-format`, `cppcheck`
**Java:** `checkstyle`, `pmd`, `spotbugs`, `sonarqube`
**PHP:** `phpcs`, `phpmd`, `phpstan`, `psalm`, `php-cs-fixer`
**Lua:** `luacheck`
**Shell:** `shellcheck`
**IaC:** `checkov`, `tflint`
**Protobuf:** `buf`
**SQL:** `sqlfluff`
**YAML:** `yamllint`
**Markdown:** `markdownlint`
**HTML/Django:** `djlint`, `djhtml`
**Git:** `commitlint`

---

## High Level (Runs Code / Irreversible / Network)

### Explicit High Commands

| Category | Commands |
|---|---|
| Git remote | `git push` (any form including `--force`) |
| Git irreversible | `git reset --hard` |
| Network | `curl`, `wget` |
| Shell + HTTP | `bash`, `sh`, `zsh` (when URL contains `http://` or `https://`) |
| Docker | `docker push`, `docker login`, `docker logout` |
| Deployment | `kubectl`, `helm`, `terraform`, `pulumi`, `ansible` |
| Remote access | `ssh`, `scp`, `rsync` |

### Shell Execution Commands (Any Arguments)

`eval`, `exec`, `source`, `.`, `env`, `command`, `builtin`, `time`, `nice`, `nohup`, `timeout`, `watch`, `strace`

### Conditional Classification

| Scenario | Level |
|---|---|
| Pipeline where next command is `bash`, `sh`, `zsh`, `node`, `python`, `python3`, `ruby`, `perl` | High |
| `xargs` running a non-minimal command | High (falls through default) |
| Output redirection (`>`, `>>`) to non-special files | Low (raises minimum from minimal) |

### Default High (Falls Through)

Any command not matched by minimal, medium, or high-level rules defaults to **high**. This includes:
- Running scripts: `python script.py`, `node app.js`, `cargo run`, `go run`
- Package executors: `npx`, `bunx`, `pnpx`
- Git operations not in the medium list: `git clean`, `git restore`
- Any unrecognized command

---

## Dangerous (Always Prompts — Even at High Level)

| Command | Condition |
|---|---|
| `sudo` | Any form |
| `rm` | With both `-r`/`--recursive` AND `-f`/`--force` flags |
| `chmod` | With `777` or `a+rwx` |
| `dd` | With `of=/dev/...` |
| `fdisk`, `parted`, `format` | Any form |
| `mkfs*` | Any variant (e.g., `mkfs`, `mkfs.ext4`) |
| `shutdown`, `reboot`, `halt`, `poweroff`, `init` | Any form |
| Fork bomb | `:(){ :|:& };:` pattern |

---

## Shell Trick Detection

Commands containing these patterns are classified as **HIGH**:

| Pattern | Description |
|---|---|
| `$(cmd)` | Command substitution |
| `` `cmd` `` | Backtick substitution |
| `<(cmd)` | Process substitution (input) |
| `>(cmd)` | Process substitution (output) |
| `${VAR:-$(cmd)}` | Dangerous brace expansion with nested command substitution |
| `$(...)` inside shell-quote AST | Any command substitution found during parsing |
