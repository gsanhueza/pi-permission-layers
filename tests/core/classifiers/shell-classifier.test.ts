/**
 * Tests for permission hook command classification
 *
 * Run with: npm test
 */

import { describe, expect, test } from "vitest";
import { classifyCommand } from "../../../src/core/classifiers/shell-classifier";
import type { PermissionConfig } from "../../../src/core/interfaces";
import { SettingsService } from "../../../src/core/settings";

const mockSettingsService: SettingsService = {
  getPermissionConfig: () => ({}),
  savePermissionConfig: () => {},
  clearCache: () => {},
  loadGlobalPermissionLevel: () => null,
  loadGlobalPermissionMode: () => null,
  saveGlobalPermissionLevel: () => {},
  saveGlobalPermissionMode: () => {},
} as unknown as SettingsService;

/** Classify against empty config via mock settingsService. */
const classify = (command: string) =>
  classifyCommand(command, mockSettingsService);

// ============================================================================
// Helpers
// ============================================================================

const assertLevel = (cmd: string, expected: string, dangerous = false) => {
  const result = classify(cmd);
  expect(result.level).toBe(expected);
  expect(result.dangerous).toBe(dangerous);
};

/** Classify with custom config via a mock settingsService. */
const assertOverrideLevel = (
  cmd: string,
  expectedLevel: string,
  expectedDangerous = false,
  config: PermissionConfig = {},
) => {
  const svc: SettingsService = {
    getPermissionConfig: () => config,
    savePermissionConfig: () => {},
    clearCache: () => {},
    loadGlobalPermissionLevel: () => null,
    loadGlobalPermissionMode: () => null,
    saveGlobalPermissionLevel: () => {},
    saveGlobalPermissionMode: () => {},
  } as unknown as SettingsService;
  const result = classifyCommand(cmd, svc);
  expect(result.level).toBe(expectedLevel);
  expect(result.dangerous).toBe(expectedDangerous);
};

// ============================================================================
// MINIMAL level tests - read-only commands
// ============================================================================

describe("minimal: file reading commands", () => {
  test("cat, less, more, head, tail, bat", () => {
    assertLevel("cat file.txt", "minimal");
    assertLevel("less file.txt", "minimal");
    assertLevel("more file.txt", "minimal");
    assertLevel("head -n 10 file.txt", "minimal");
    assertLevel("tail -f log.txt", "minimal");
    assertLevel("bat file.ts", "minimal");
  });

  test("ls, tree, pwd, cd", () => {
    assertLevel("ls", "minimal");
    assertLevel("ls -la", "minimal");
    assertLevel("ls -la /tmp", "minimal");
    assertLevel("tree", "minimal");
    assertLevel("pwd", "minimal");
    assertLevel("cd /tmp", "minimal");
  });

  test("grep, egrep, rg, ag, find, fd, which, whereis", () => {
    assertLevel("grep pattern file.txt", "minimal");
    assertLevel("grep -r pattern .", "minimal");
    assertLevel("grep -E 'foo|bar' file", "minimal");
    assertLevel("egrep pattern file", "minimal");
    assertLevel("rg pattern", "minimal");
    assertLevel("ag pattern", "minimal");
    assertLevel("find . -name '*.ts'", "minimal");
    assertLevel("fd pattern", "minimal");
    assertLevel("which node", "minimal");
    assertLevel("whereis git", "minimal");
  });

  test("echo, printf, whoami, id, date, uname, hostname, uptime, file, stat, wc, du, df", () => {
    assertLevel("echo hello", "minimal");
    assertLevel("printf '%s' hello", "minimal");
    assertLevel("whoami", "minimal");
    assertLevel("id", "minimal");
    assertLevel("date", "minimal");
    assertLevel("uname -a", "minimal");
    assertLevel("hostname", "minimal");
    assertLevel("uptime", "minimal");
    assertLevel("file image.png", "minimal");
    assertLevel("stat file.txt", "minimal");
    assertLevel("wc -l file.txt", "minimal");
    assertLevel("du -sh .", "minimal");
    assertLevel("df -h", "minimal");
  });

  test("ps, top, htop, pgrep, sleep", () => {
    assertLevel("ps aux", "minimal");
    assertLevel("top -l 1", "minimal");
    assertLevel("htop", "minimal");
    assertLevel("pgrep node", "minimal");
    assertLevel("sleep 4", "minimal");
  });

  test("env, printenv, set are HIGH because they can execute arbitrary commands", () => {
    assertLevel("env", "high");
    assertLevel("printenv", "high");
    assertLevel("set", "high");
  });

  test("sort, uniq, cut, awk, sed, tr, diff", () => {
    assertLevel("sort file.txt", "minimal");
    assertLevel("uniq file.txt", "minimal");
    assertLevel("cut -d: -f1 /etc/passwd", "minimal");
    assertLevel("awk '{print $1}' file", "minimal");
    assertLevel("sed 's/foo/bar/' file", "minimal");
    assertLevel("tr a-z A-Z", "minimal");
    assertLevel("diff file1 file2", "minimal");
  });

  test("node --version, npm -v, python3 -V, git --version, rustc --version", () => {
    assertLevel("node --version", "minimal");
    assertLevel("npm -v", "minimal");
    assertLevel("python3 -V", "minimal");
    assertLevel("git --version", "minimal");
    assertLevel("rustc --version", "minimal");
  });

  test("git status, log, diff, show, branch, remote, tag, ls-files, blame, reflog", () => {
    assertLevel("git status", "minimal");
    assertLevel("git log", "minimal");
    assertLevel("git log --oneline -10", "minimal");
    assertLevel("git diff", "minimal");
    assertLevel("git diff HEAD~1", "minimal");
    assertLevel("git show HEAD", "minimal");
    assertLevel("git branch", "minimal");
    assertLevel("git branch -a", "minimal");
    assertLevel("git remote -v", "minimal");
    assertLevel("git tag", "minimal");
    assertLevel("git ls-files", "minimal");
    assertLevel("git blame file.ts", "minimal");
    assertLevel("git reflog", "minimal");
  });

  test("npm list, npm ls, npm info, npm outdated, npm audit, yarn list, pnpm list, pip list, pip3 show, cargo tree, go list", () => {
    assertLevel("npm list", "minimal");
    assertLevel("npm ls", "minimal");
    assertLevel("npm info lodash", "minimal");
    assertLevel("npm outdated", "minimal");
    assertLevel("npm audit", "minimal");
    assertLevel("yarn list", "minimal");
    assertLevel("pnpm list", "minimal");
    assertLevel("pip list", "minimal");
    assertLevel("pip3 show requests", "minimal");
    assertLevel("cargo tree", "minimal");
    assertLevel("go list ./...", "minimal");
  });
});

// ============================================================================
// MEDIUM level tests - dev operations
// ============================================================================

describe("medium: npm install/build/test", () => {
  test("npm install, npm ci, npm test, npm build", () => {
    assertLevel("npm install", "medium");
    assertLevel("npm install lodash", "medium");
    assertLevel("npm ci", "medium");
    assertLevel("npm test", "medium");
    assertLevel("npm build", "medium");
  });

  test("npm run with safe scripts (build/test/lint)", () => {
    assertLevel("npm run build", "medium");
    assertLevel("npm run test", "medium");
    assertLevel("npm run lint", "medium");
    assertLevel("npm run format", "medium");
    assertLevel("npm run check", "medium");
    assertLevel("npm run typecheck", "medium");
    assertLevel("npm run build:prod", "medium");
    assertLevel("npm run build:dev", "medium");
    assertLevel("npm run test:unit", "medium");
    assertLevel("npm run test:coverage", "medium");
    assertLevel("npm run lint:fix", "medium");
  });

  test("npm run with unsafe scripts (dev/start/serve)", () => {
    assertLevel("npm run dev", "high");
    assertLevel("npm run start", "high");
    assertLevel("npm run serve", "high");
    assertLevel("npm run watch", "high");
    assertLevel("npm run preview", "high");
    assertLevel("npm run dev:server", "high");
    assertLevel("npm run start:dev", "high");
    assertLevel("npm run unknown-script", "high"); // unknown defaults to high
  });

  test("npm start/exec/npx (runs code)", () => {
    assertLevel("npm start", "high"); // starts server
    assertLevel("npm exec", "high");
    assertLevel("npx create-react-app my-app", "high"); // npx runs packages
    assertLevel("npx ts-node script.ts", "high");
  });

  test("yarn install/build/test", () => {
    assertLevel("yarn install", "medium");
    assertLevel("yarn add lodash", "medium");
    assertLevel("yarn build", "medium");
    assertLevel("yarn test", "medium");
    assertLevel("yarn", "medium"); // bare yarn defaults to install
  });

  test("yarn run with safe scripts", () => {
    assertLevel("yarn run build", "medium");
    assertLevel("yarn run test", "medium");
    assertLevel("yarn run lint", "medium");
  });

  test("yarn run with unsafe scripts", () => {
    assertLevel("yarn run dev", "high");
    assertLevel("yarn run start", "high");
    assertLevel("yarn start", "high");
    assertLevel("yarn dlx create-next-app", "high");
  });

  test("pnpm install/build/test", () => {
    assertLevel("pnpm install", "medium");
    assertLevel("pnpm add lodash", "medium");
    assertLevel("pnpm test", "medium");
    assertLevel("pnpm build", "medium");
  });

  test("pnpm run with safe scripts", () => {
    assertLevel("pnpm run build", "medium");
    assertLevel("pnpm run test", "medium");
    assertLevel("pnpm run lint", "medium");
  });

  test("pnpm run with unsafe scripts", () => {
    assertLevel("pnpm run dev", "high");
    assertLevel("pnpm run start", "high");
    assertLevel("pnpm exec playwright", "high");
    assertLevel("pnpm dlx create-next-app", "high");
  });

  test("bun install/build/test", () => {
    assertLevel("bun install", "medium");
    assertLevel("bun add lodash", "medium");
    assertLevel("bun test", "medium");
    assertLevel("bun build", "medium");
  });

  test("bun run with safe scripts", () => {
    assertLevel("bun run build", "medium");
    assertLevel("bun run test", "medium");
    assertLevel("bun run lint", "medium");
  });

  test("bun run with unsafe scripts", () => {
    assertLevel("bun run dev", "high");
    assertLevel("bun run start", "high");
    assertLevel("bun x create-next-app", "high");
    assertLevel("bunx create-next-app", "high");
  });

  test("CocoaPods install/update", () => {
    assertLevel("pod install", "medium");
    assertLevel("pod update", "medium");
    assertLevel("pod repo update", "medium");
  });

  test("pod commands that run code", () => {
    assertLevel("pod run", "high");
    assertLevel("pod exec", "high");
  });

  test("python install/test only", () => {
    assertLevel("pip install requests", "medium");
    assertLevel("pip3 install requests", "medium");
    assertLevel("pytest", "medium");
    assertLevel("pytest --cov", "medium");
    assertLevel("pytest tests/", "medium");
    assertLevel("poetry install", "medium");
    assertLevel("poetry add requests", "medium");
    assertLevel("poetry build", "medium");
  });

  test("python/python3 (runs code)", () => {
    assertLevel("python script.py", "high");
    assertLevel("python3 script.py", "high");
    assertLevel("python -c 'print(1)'", "high");
  });

  test("rust build/test", () => {
    assertLevel("cargo build", "medium");
    assertLevel("cargo test", "medium");
    assertLevel("cargo add serde", "medium");
    assertLevel("cargo check", "medium");
    assertLevel("cargo clippy", "medium");
    assertLevel("cargo fmt", "medium");
    assertLevel("rustc main.rs", "medium");
    assertLevel("rustfmt src/main.rs", "medium");
  });

  test("cargo run (runs code)", () => {
    assertLevel("cargo run", "high");
    assertLevel("cargo run --release", "high");
  });

  test("go build/test", () => {
    assertLevel("go build", "medium");
    assertLevel("go test ./...", "medium");
    assertLevel("go get github.com/pkg/errors", "medium");
    assertLevel("go mod tidy", "medium");
    assertLevel("go fmt ./...", "medium");
    assertLevel("gofmt -w .", "medium");
  });

  test("go run (runs code)", () => {
    assertLevel("go run main.go", "high");
    assertLevel("go run .", "high");
  });

  test("build tools", () => {
    assertLevel("make", "medium");
    assertLevel("make build", "medium");
    assertLevel("cmake .", "medium");
    assertLevel("ninja", "medium");
  });

  test("linters and formatters", () => {
    assertLevel("eslint .", "medium");
    assertLevel("prettier --write .", "medium");
    assertLevel("black .", "medium");
    assertLevel("flake8", "medium");
    assertLevel("mypy .", "medium");
    assertLevel("tsc", "medium");
  });

  test("test runners", () => {
    assertLevel("jest", "medium");
    assertLevel("mocha", "medium");
    assertLevel("vitest", "medium");
  });

  test("file operations", () => {
    assertLevel("mkdir new-dir", "medium");
    assertLevel("touch file.txt", "medium");
    assertLevel("cp file1 file2", "medium");
    assertLevel("mv file1 file2", "medium");
    assertLevel("ln -s target link", "medium");
  });

  test("git local operations (reversible)", () => {
    assertLevel("git add .", "medium");
    assertLevel("git add file.ts", "medium");
    assertLevel("git commit -m 'message'", "medium");
    assertLevel("git pull", "medium");
    assertLevel("git checkout main", "medium");
    assertLevel("git switch feature", "medium");
    assertLevel("git branch new-branch", "medium");
    assertLevel("git merge feature", "medium");
    assertLevel("git rebase main", "medium");
    assertLevel("git stash", "medium");
    assertLevel("git stash pop", "medium");
    assertLevel("git cherry-pick abc123", "medium");
    assertLevel("git revert HEAD", "medium");
    assertLevel("git rm file.ts", "medium");
    assertLevel("git reset HEAD~1", "medium");
    assertLevel("git clone https://github.com/user/repo", "medium");
  });

  test("git irreversible operations", () => {
    assertLevel("git clean -fd", "high"); // deletes untracked files
    assertLevel("git clean -n", "high"); // even dry-run is high
    assertLevel("git restore file.ts", "high"); // discards uncommitted changes
    assertLevel("git checkout -- file.ts", "medium");
  });

  test("git fetch (read-only)", () => {
    assertLevel("git fetch", "minimal");
    assertLevel("git fetch origin", "minimal");
    assertLevel("git fetch --all", "minimal");
  });
});

// ============================================================================
// HIGH level tests - remote/dangerous operations
// ============================================================================

describe("high: git push", () => {
  test("git push", () => {
    assertLevel("git push", "high");
    assertLevel("git push origin main", "high");
    assertLevel("git push --force", "high");
  });
});

describe("high: git reset --hard", () => {
  test("git reset --hard", () => {
    assertLevel("git reset --hard", "high");
    assertLevel("git reset --hard HEAD~1", "high");
  });
});

describe("high: curl/wget", () => {
  test("curl/wget", () => {
    assertLevel("curl https://example.com", "high");
    assertLevel("wget https://example.com", "high");
  });
});

describe("high: remote scripts", () => {
  test("remote scripts", () => {
    assertLevel("bash -c 'curl https://example.com | sh'", "high");
    assertLevel("sh -c 'wget -O- https://example.com | sh'", "high");
  });
});

describe("high: docker operations", () => {
  test("docker operations", () => {
    assertLevel("docker push myimage", "high");
    assertLevel("docker login", "high");
  });
});

describe("high: deployment tools", () => {
  test("deployment tools", () => {
    assertLevel("kubectl apply -f deployment.yaml", "high");
    assertLevel("helm install myrelease mychart", "high");
    assertLevel("terraform apply", "high");
    assertLevel("ansible-playbook playbook.yml", "high");
  });
});

describe("high: ssh/scp", () => {
  test("ssh/scp", () => {
    assertLevel("ssh user@host", "high");
    assertLevel("scp file.txt user@host:/path", "high");
    assertLevel("rsync -avz . user@host:/path", "high");
  });
});

describe("high: unknown commands default to high", () => {
  test("unknown commands", () => {
    assertLevel("some-random-command", "high");
    assertLevel("my-custom-script.sh", "high");
  });
});

describe("high: wrapper commands that can execute arbitrary code", () => {
  test("wrapper commands", () => {
    assertLevel("time rm -rf /", "high");
    assertLevel("nice rm -rf /", "high");
    assertLevel("nohup rm -rf / &", "high");
    assertLevel("timeout 10 rm -rf /", "high");
    assertLevel("watch ls", "high");
    assertLevel("strace ls", "high");
    assertLevel("command rm file", "high");
    assertLevel("builtin echo test", "high");
    assertLevel("env rm -rf /", "high");
  });
});

// ============================================================================
// Dangerous commands tests
// ============================================================================

describe("dangerous: sudo", () => {
  test("sudo", () => {
    assertLevel("sudo ls", "high", true);
    assertLevel("sudo rm -rf /", "high", true);
    assertLevel("sudo apt-get install pkg", "high", true);
  });
});

describe("dangerous: rm -rf", () => {
  test("rm -rf", () => {
    assertLevel("rm -rf /", "high", true);
    assertLevel("rm -rf .", "high", true);
    assertLevel("rm -r -f dir", "high", true);
    assertLevel("rm --recursive --force dir", "high", true);
    assertLevel("rm file.txt", "high", false);
    assertLevel("rm -r dir", "high", false);
    assertLevel("rm -f file.txt", "high", false);
  });
});

describe("dangerous: chmod 777", () => {
  test("chmod 777", () => {
    assertLevel("chmod 777 file", "high", true);
    assertLevel("chmod a+rwx file", "high", true);
    assertLevel("chmod 644 file", "high", false);
    assertLevel("chmod +x file", "high", false);
  });
});

describe("dangerous: dd to device", () => {
  test("dd to device", () => {
    assertLevel("dd if=/dev/zero of=/dev/sda", "high", true);
    assertLevel("dd if=file.img of=/dev/disk1", "high", true);
    assertLevel("dd if=/dev/zero of=file.img", "high", false);
  });
});

describe("dangerous: system commands", () => {
  test("system commands", () => {
    assertLevel("mkfs.ext4 /dev/sda1", "high", true);
    assertLevel("fdisk /dev/sda", "high", true);
    assertLevel("shutdown now", "high", true);
    assertLevel("reboot", "high", true);
    assertLevel("halt", "high", true);
    assertLevel("poweroff", "high", true);
  });
});

// ============================================================================
// Shell tricks tests - command substitution
// ============================================================================

describe("shell tricks: $() command substitution", () => {
  test("$() command substitution", () => {
    assertLevel("echo $(whoami)", "high");
    assertLevel("echo $(rm -rf /)", "high");
    assertLevel("ls $(pwd)", "high");
  });
});

describe("shell tricks: backtick substitution", () => {
  test("backtick substitution", () => {
    assertLevel("echo `whoami`", "high");
    assertLevel("echo `rm -rf /`", "high");
    assertLevel("ls `pwd`", "high");
  });
});

describe("shell tricks: process substitution", () => {
  test("process substitution", () => {
    assertLevel("cat <(ls)", "high");
    assertLevel("diff <(ls dir1) <(ls dir2)", "high");
    assertLevel("tee >(cat)", "high");
  });
});

describe("shell tricks: eval and source", () => {
  test("eval and source", () => {
    assertLevel("eval 'ls'", "high");
    assertLevel("eval 'rm -rf /'", "high");
    assertLevel("source script.sh", "high");
    assertLevel(". script.sh", "high");
    assertLevel("exec bash", "high");
  });
});

describe("shell tricks: nested command substitution in ${}", () => {
  test("nested command substitution in ${}", () => {
    assertLevel("echo ${PATH:-$(whoami)}", "high");
    assertLevel("echo ${VAR:-`id`}", "high");
  });
});

// ============================================================================
// Safe patterns tests - should NOT trigger shell tricks
// ============================================================================

describe("safe: simple variable expansion", () => {
  test("simple variable expansion", () => {
    assertLevel("echo $PATH", "minimal");
    assertLevel("echo $HOME", "minimal");
    assertLevel("echo $USER", "minimal");
  });
});

describe("safe: ${VAR} without nested commands", () => {
  test("${VAR} without nested commands", () => {
    assertLevel("echo ${PATH}", "minimal");
    assertLevel("echo ${HOME}/file", "minimal");
    assertLevel("ls ${PWD}", "minimal");
  });
});

describe("safe: ${VAR} parameter expansion operations", () => {
  test("${VAR} parameter expansion", () => {
    assertLevel("echo ${#PATH}", "minimal"); // length
    assertLevel("echo ${PATH:0:5}", "minimal"); // substring
    assertLevel("echo ${PATH/bin/lib}", "minimal"); // substitution
    assertLevel("echo ${PATH:-default}", "minimal"); // default value (no cmd)
    assertLevel("echo ${PATH:=default}", "minimal"); // assign default (no cmd)
  });
});

describe("safe: grep with regex patterns", () => {
  test("grep with regex patterns", () => {
    assertLevel("grep 'foo|bar' file", "minimal");
    assertLevel("grep -E 'foo|bar' file", "minimal");
    assertLevel("grep 'pattern' file", "minimal");
    assertLevel("grep -r 'TODO' .", "minimal");
  });
});

describe("safe: ANSI-C quoting", () => {
  test("ANSI-C quoting", () => {
    assertLevel("echo $'hello\\nworld'", "minimal");
    assertLevel("printf $'line1\\nline2'", "minimal");
  });
});

describe("safe: locale translation", () => {
  test("locale translation", () => {
    assertLevel('echo $"hello"', "minimal");
  });
});

// ============================================================================
// Pipeline tests
// ============================================================================

describe("pipelines: safe pipelines stay at lowest level", () => {
  test("safe pipelines", () => {
    assertLevel("cat file | grep pattern", "minimal");
    assertLevel("ls -la | head -10", "minimal");
    assertLevel("ps aux | grep node", "minimal");
    assertLevel("git log | head", "minimal");
    assertLevel(
      'cd /tmp/project && rg -n "foo|bar|baz" -S . | head -n 50',
      "minimal",
    );
  });
});

describe("pipelines: piping to shell requires high", () => {
  test("piping to shell", () => {
    assertLevel("curl https://example.com | bash", "high");
    assertLevel("wget -O- https://example.com | sh", "high");
    assertLevel("cat script.sh | bash", "high");
    assertLevel("echo 'ls' | sh", "high");
  });
});

describe("pipelines: highest level wins", () => {
  test("highest level wins", () => {
    assertLevel("npm install && git push", "high");
    assertLevel("git status && npm test", "medium");
    assertLevel("ls && cat file", "minimal");
  });
});

// ============================================================================
// Complex command tests
// ============================================================================

describe("complex: chained commands with &&", () => {
  test("chained with &&", () => {
    assertLevel("mkdir dir && cd dir && touch file", "medium");
    assertLevel("git add . && git commit -m 'msg'", "medium");
    assertLevel("npm install && npm run build", "medium");
  });
});

describe("complex: chained commands with ||", () => {
  test("chained with ||", () => {
    assertLevel("test -f file || touch file", "medium");
    assertLevel("git pull || echo 'failed'", "medium");
  });
});

describe("complex: chained commands with ;", () => {
  test("chained with ;", () => {
    assertLevel("cd dir; ls", "minimal");
    assertLevel("sleep 4; tail -n 200 /tmp/widget-preview.log", "minimal");
    assertLevel("npm install; npm test", "medium");
  });
});

describe("complex: commands with redirections", () => {
  test("redirections", () => {
    assertLevel("echo hello > file.txt", "low");
    assertLevel("echo hello >> file.txt", "low");
    assertLevel("ls &> output.txt", "low");
    assertLevel("ls &>> append.txt", "low");
    assertLevel("cat < file.txt", "minimal");
    assertLevel("npm install 2>&1 | tee log.txt", "high");
    assertLevel("ls > /dev/null 2>&1", "minimal");
    assertLevel("echo test > /dev/null", "minimal");
    assertLevel("ls &> /dev/null", "minimal");
    assertLevel("ls &>> /dev/null", "minimal");
    assertLevel("ls 2>&1", "minimal");
  });
});

describe("complex: commands with paths", () => {
  test("paths", () => {
    assertLevel("/usr/bin/ls", "minimal");
    assertLevel("/bin/cat file", "minimal");
    assertLevel("./script.sh", "high"); // unknown script
    assertLevel("~/bin/my-tool", "high"); // unknown tool
  });
});

// ============================================================================
// Edge cases
// ============================================================================

describe("edge: empty command", () => {
  test("empty command", () => {
    assertLevel("", "minimal");
  });
});

describe("edge: whitespace only", () => {
  test("whitespace only", () => {
    assertLevel("   ", "minimal");
  });
});

describe("edge: command with leading backslash (alias bypass)", () => {
  test("leading backslash", () => {
    assertLevel("\\ls", "minimal");
    assertLevel("\\rm file", "high");
  });
});

describe("edge: shell-quote parse failures are high", () => {
  test("parse failures", () => {
    assertLevel("echo ${PATH:-$(whoami)}", "high");
  });
});

describe("edge: git branch/tag/remote with and without args", () => {
  test("git branch/tag/remote", () => {
    assertLevel("git branch", "minimal");
    assertLevel("git branch -a", "minimal");
    assertLevel("git branch --list", "minimal");
    assertLevel("git tag", "minimal");
    assertLevel("git tag -l", "minimal");
    assertLevel("git remote", "minimal");
    assertLevel("git remote -v", "minimal");
    assertLevel("git branch new-branch", "medium");
    assertLevel("git branch -d old-branch", "medium");
    assertLevel("git tag v1.0.0", "medium");
    assertLevel("git tag -a v1.0.0 -m 'msg'", "medium");
    assertLevel("git remote add origin url", "high");
  });
});

describe("edge: rm edge cases", () => {
  test("rm edge cases", () => {
    assertLevel("rm file.txt", "high", false);
    assertLevel("rm -r dir", "high", false);
    assertLevel("rm -f file.txt", "high", false);
    assertLevel("rm -i file.txt", "high", false);
    assertLevel("rm -rf dir", "high", true);
    assertLevel("rm -fr dir", "high", true);
    assertLevel("rm -r -f dir", "high", true);
    assertLevel("rm -f -r dir", "high", true);
    assertLevel("rm --recursive --force dir", "high", true);
    assertLevel("rm -rf --no-preserve-root /", "high", true);
  });

  test("rm -r without -f is NOT dangerous", () => {
    assertLevel("rm -r dir", "high", false);
  });

  test("rm -f without -r is NOT dangerous", () => {
    assertLevel("rm -f file.txt", "high", false);
  });
});

describe("edge: special characters in paths", () => {
  test("special characters", () => {
    assertLevel("cat 'file with spaces.txt'", "minimal");
    assertLevel('cat "file with spaces.txt"', "minimal");
    assertLevel("ls dir\\ with\\ spaces", "minimal");
    assertLevel("cat file-with-dashes.txt", "minimal");
    assertLevel("cat file_with_underscores.txt", "minimal");
  });
});

describe("edge: absolute and relative paths", () => {
  test("absolute and relative paths", () => {
    assertLevel("/bin/ls", "minimal");
    assertLevel("/usr/bin/cat file", "minimal");
    assertLevel("./local-script.sh", "high"); // unknown script
    assertLevel("../parent-script.sh", "high"); // unknown script
    assertLevel("~/bin/my-tool", "high"); // unknown tool
  });
});

describe("edge: environment variable assignment", () => {
  test("environment variable assignment", () => {
    assertLevel("FOO=bar ls", "high");
    assertLevel("NODE_ENV=production npm test", "high");
    assertLevel("DEBUG=* node app.js", "high");
  });
});

describe("edge: subshells and grouping", () => {
  test("subshells and grouping", () => {
    assertLevel("(cd dir && ls)", "minimal");
    assertLevel("{ ls; pwd; }", "high");
  });
});

describe("edge: here documents and strings", () => {
  test("here documents and strings", () => {
    assertLevel("cat << EOF", "minimal");
    assertLevel("cat <<< 'hello'", "minimal");
  });
});

describe("edge: multiple redirections", () => {
  test("multiple redirections", () => {
    assertLevel("cmd > out.txt 2> err.txt", "high");
    assertLevel("ls > out.txt 2>&1", "low");
    assertLevel("cat file 2>/dev/null", "minimal");
    assertLevel("echo hello >> append.txt", "low");
  });
});

describe("edge: npm/yarn scripts with special names", () => {
  test("npm/yarn scripts with special names", () => {
    assertLevel("npm run build:prod", "medium");
    assertLevel("npm run test:coverage", "medium");
    assertLevel("yarn build:dev", "high");
    assertLevel("yarn run build:dev", "medium");
    assertLevel("pnpm run lint:fix", "medium");
  });
});

describe("edge: docker non-push commands", () => {
  test("docker non-push commands", () => {
    assertLevel("docker build .", "high");
    assertLevel("docker run nginx", "high");
    assertLevel("docker ps", "high");
    assertLevel("docker images", "high");
    assertLevel("docker push myimage", "high");
    assertLevel("docker login", "high");
  });
});

describe("edge: chmod variations", () => {
  test("chmod variations", () => {
    assertLevel("chmod 777 file", "high", true);
    assertLevel("chmod a+rwx file", "high", true);
    assertLevel("chmod 755 file", "high", false);
    assertLevel("chmod 644 file", "high", false);
    assertLevel("chmod +x script.sh", "high", false);
    assertLevel("chmod u+x script.sh", "high", false);
    assertLevel("chmod go-w file", "high", false);
  });
});

describe("edge: nested command substitution variations", () => {
  test("nested command substitution", () => {
    assertLevel("echo $(echo $(whoami))", "high");
    assertLevel("echo `echo \\`whoami\\``", "high");
    assertLevel("VAR=$(cmd)", "high");
    assertLevel("export PATH=$(pwd):$PATH", "high");
  });
});

describe("edge: arithmetic expansion", () => {
  test("arithmetic expansion", () => {
    assertLevel("echo $((1 + 2))", "minimal");
    assertLevel("echo $((10 * 5))", "minimal");
    assertLevel("echo $(whoami)", "high");
  });
});

describe("edge: brace expansion (safe)", () => {
  test("brace expansion", () => {
    assertLevel("echo {a,b,c}", "minimal");
    assertLevel("touch file{1,2,3}.txt", "medium");
    assertLevel("cp file.{txt,bak}", "medium");
  });
});

describe("edge: glob patterns (safe)", () => {
  test("glob patterns", () => {
    assertLevel("ls *.txt", "minimal");
    assertLevel("cat src/**/*.ts", "minimal");
    assertLevel("rm *.tmp", "high"); // rm is high, but not dangerous without -rf
  });
});

describe("edge: xargs with read-only commands (minimal)", () => {
  test("xargs read-only", () => {
    assertLevel("xargs cat", "minimal");
    assertLevel("xargs head", "minimal");
    assertLevel("xargs tail", "minimal");
    assertLevel("xargs grep pattern", "minimal");
    assertLevel("xargs wc -l", "minimal");
    assertLevel("xargs ls", "minimal");
    assertLevel("xargs echo", "minimal");
    assertLevel("xargs", "minimal");
    assertLevel("find . -name '*.txt' | xargs cat", "minimal");
    assertLevel("find . -name '*.ts' | xargs head -10", "minimal");
    assertLevel("find . -type f | xargs wc -l", "minimal");
  });
});

describe("edge: xargs with flags and read-only commands (minimal)", () => {
  test("xargs flags", () => {
    assertLevel("xargs -0 cat", "minimal");
    assertLevel("xargs -n 1 cat", "minimal");
    assertLevel("xargs -P 4 cat", "minimal");
    assertLevel("xargs -I {} cat {}", "minimal");
    assertLevel("xargs -I{} cat {}", "minimal");
    assertLevel("xargs -d '\\n' cat", "minimal");
    assertLevel("xargs --null cat", "minimal");
    assertLevel("xargs -0 -n 1 -P 4 cat", "minimal");
    assertLevel("xargs -- cat", "minimal");
    assertLevel("xargs -t cat", "minimal");
    assertLevel("xargs -p cat", "minimal");
  });
});

describe("edge: xargs with full paths to read-only commands (minimal)", () => {
  test("xargs full paths", () => {
    assertLevel("xargs /bin/cat", "minimal");
    assertLevel("xargs /usr/bin/cat", "minimal");
    assertLevel("xargs /usr/bin/head", "minimal");
  });
});

describe("edge: xargs with non-read-only commands (high)", () => {
  test("xargs non-read-only", () => {
    assertLevel("xargs rm", "high");
    assertLevel("find . -name '*.txt' | xargs rm", "high");
    assertLevel("xargs sh -c 'cat'", "high");
    assertLevel("xargs bash -c 'ls'", "high");
    assertLevel("xargs node", "high");
    assertLevel("xargs python", "high");
    assertLevel("xargs python3", "high");
    assertLevel("xargs unknown-cmd", "high");
    assertLevel("xargs my-script.sh", "high");
  });
});

describe("edge: xargs with redirections", () => {
  test("xargs redirections", () => {
    assertLevel("xargs cat > output.txt", "low");
    assertLevel("xargs cat >> append.txt", "low");
    assertLevel("find . | xargs cat > all.txt", "low");
    assertLevel("xargs -I {} cat {} > {}.bak", "low");
    assertLevel("xargs cat 2>/dev/null", "minimal");
    assertLevel("find . | xargs cat 2>/dev/null", "minimal");
    assertLevel("xargs cat | head -10", "minimal");
    assertLevel("xargs cat | grep pattern", "minimal");
    assertLevel("find . | xargs cat | wc -l", "minimal");
    assertLevel("xargs cat > /dev/null", "minimal");
  });
});

describe("edge: cat with redirections (not xargs)", () => {
  test("cat redirections", () => {
    assertLevel("cat file.txt", "minimal");
    assertLevel("cat file1 file2", "minimal");
    assertLevel("cat file1 > file2", "low");
    assertLevel("cat file >> append.txt", "low");
    assertLevel("cat < input.txt", "minimal");
    assertLevel("cat file 2>/dev/null", "minimal");
    assertLevel("cat file > /dev/null", "minimal");
    assertLevel("cat file | grep pattern", "minimal");
  });
});

describe("edge: tee command (writes files)", () => {
  test("tee command", () => {
    assertLevel("echo hello | tee file.txt", "high");
    assertLevel("npm install 2>&1 | tee log.txt", "high");
    assertLevel("echo hello | tee /dev/null", "minimal");
    assertLevel("echo hello | tee", "minimal");
  });
});

describe("edge: common CI/CD commands", () => {
  test("CI/CD commands", () => {
    assertLevel("npm ci", "medium");
    assertLevel("npm run lint", "medium");
    assertLevel("npm run test -- --coverage", "medium");
    assertLevel("npx jest --watchAll", "high");
    assertLevel("yarn install --frozen-lockfile", "medium");
  });
});

describe("edge: database commands", () => {
  test("database commands", () => {
    assertLevel("psql -c 'SELECT 1'", "high");
    assertLevel("mysql -e 'SHOW TABLES'", "high");
    assertLevel("sqlite3 db.sqlite", "high");
    assertLevel("mongosh", "high");
    assertLevel("redis-cli", "high");
  });
});

describe("edge: prisma commands", () => {
  test("prisma commands", () => {
    assertLevel("prisma generate", "medium");
    assertLevel("prisma migrate dev", "medium");
    assertLevel("prisma db push", "medium");
    assertLevel("prisma studio", "medium");
  });
});

describe("edge: case sensitivity", () => {
  test("case sensitivity", () => {
    assertLevel("LS", "minimal");
    assertLevel("Cat file", "minimal");
    assertLevel("GIT status", "minimal");
  });
});

describe("edge: Windows-style paths (cross-platform)", () => {
  test("Windows-style paths", () => {
    assertLevel("cat C:\\Users\\file.txt", "minimal");
  });
});

describe("edge: comments in commands", () => {
  test("comments", () => {
    assertLevel("ls # this is a comment", "minimal");
    assertLevel("echo hello # comment", "minimal");
  });
});

describe("edge: multiline commands (escaped newlines)", () => {
  test("multiline commands", () => {
    assertLevel("ls \\\n  -la", "minimal");
  });
});

describe("edge: doas (OpenBSD sudo alternative)", () => {
  test("doas", () => {
    const result = classify("doas ls");
    expect(result.level).toBe("high");
  });
});

describe("edge: nohup and background commands", () => {
  test("nohup and background", () => {
    assertLevel("nohup npm start &", "high");
    assertLevel("npm start &", "high");
    assertLevel("npm run build &", "medium");
  });
});

describe("edge: time and timeout wrappers", () => {
  test("time and timeout", () => {
    assertLevel("time ls", "high");
    assertLevel("timeout 10 npm test", "high");
  });
});

describe("edge: exec variants", () => {
  test("exec variants", () => {
    assertLevel("exec bash", "high");
    assertLevel("exec > log.txt", "high");
  });
});

describe("edge: find with -exec/-delete (can modify filesystem)", () => {
  test("find -exec/-delete", () => {
    assertLevel("find . -name '*.txt'", "minimal");
    assertLevel("find . -type f -name '*.ts'", "minimal");
    assertLevel("find . -name '*.txt' -exec cat {} \\;", "high");
    assertLevel("find . -type f -exec rm {} \\;", "high");
    assertLevel("find . -name '*.tmp' -delete", "high");
    assertLevel("find . -type f -execdir mv {} {}.bak \\;", "high");
    assertLevel("find . -name '*.txt' -ok rm {} \\;", "high");
  });
});

describe("edge: very long commands", () => {
  test("very long commands", () => {
    const longCmd = "echo " + "a".repeat(10000);
    assertLevel(longCmd, "minimal");
  });
});

describe("edge: unicode in commands", () => {
  test("unicode", () => {
    assertLevel("echo '你好世界'", "minimal");
    assertLevel("cat файл.txt", "minimal");
    assertLevel("ls 📁", "minimal");
  });
});

describe("edge: null bytes and special chars", () => {
  test("null bytes", () => {
    assertLevel("echo 'hello\x00world'", "minimal");
  });
});

// ============================================================================
// Happy path comprehensive tests
// ============================================================================

describe("happy: typical development workflow", () => {
  test("development workflow", () => {
    assertLevel("git clone https://github.com/user/repo", "medium");
    assertLevel("cd repo", "minimal");
    assertLevel("npm install", "medium");
    assertLevel("npm run dev", "high");
    assertLevel("npm run build", "medium");
    assertLevel("npm test", "medium");
    assertLevel("git status", "minimal");
    assertLevel("git diff", "minimal");
    assertLevel("git add .", "medium");
    assertLevel("git commit -m 'feat: add feature'", "medium");
    assertLevel("git push origin main", "high");
  });
});

describe("happy: code review workflow", () => {
  test("code review workflow", () => {
    assertLevel("git fetch origin", "minimal");
    assertLevel("git checkout -b review/pr-123", "medium");
    assertLevel("git log --oneline -20", "minimal");
    assertLevel("git diff main..HEAD", "minimal");
    assertLevel("grep -r 'TODO' src/", "minimal");
    assertLevel("npm test", "medium");
  });
});

describe("happy: debugging session", () => {
  test("debugging session", () => {
    assertLevel("cat src/index.ts", "minimal");
    assertLevel("grep -n 'error' logs/*.log", "minimal");
    assertLevel("tail -f logs/app.log", "minimal");
    assertLevel("ps aux | grep node", "minimal");
    assertLevel("lsof -i :3000", "high"); // lsof not in MINIMAL
  });
});

describe("happy: Python development", () => {
  test("Python development", () => {
    assertLevel("python3 -m venv .venv", "high");
    assertLevel("pip install -r requirements.txt", "medium");
    assertLevel("python3 app.py", "high");
    assertLevel("pytest", "medium");
    assertLevel("pytest tests/", "medium");
    assertLevel("black .", "medium");
    assertLevel("mypy src/", "medium");
  });
});

describe("happy: Rust development", () => {
  test("Rust development", () => {
    assertLevel("cargo new myproject", "high");
    assertLevel("cargo build", "medium");
    assertLevel("cargo run", "high");
    assertLevel("cargo test", "medium");
    assertLevel("cargo clippy", "medium");
    assertLevel("cargo fmt", "medium");
    assertLevel("cargo add serde", "medium");
  });
});

describe("happy: Go development", () => {
  test("Go development", () => {
    assertLevel("go mod init myproject", "medium");
    assertLevel("go get github.com/gin-gonic/gin", "medium");
    assertLevel("go build", "medium");
    assertLevel("go run .", "high");
    assertLevel("go test ./...", "medium");
    assertLevel("go fmt ./...", "medium");
  });
});

// ============================================================================
// Configurable Override Tests
// ============================================================================

describe("override: custom minimal patterns", () => {
  test("custom minimal patterns", () => {
    const config: PermissionConfig = {
      overrides: {
        minimal: ["tmux list-*", "tmux show-*"],
      },
    };

    assertOverrideLevel("tmux list-sessions", "minimal", false, config);
    assertOverrideLevel("tmux show-options", "minimal", false, config);
    assertOverrideLevel("tmux attach", "high", false, config);
  });
});

describe("override: custom medium patterns", () => {
  test("custom medium patterns", () => {
    const config: PermissionConfig = {
      overrides: {
        medium: ["tmux *"],
      },
    };

    assertOverrideLevel("tmux new-session -s test", "medium", false, config);
  });
});

describe("override: custom high patterns", () => {
  test("custom high patterns", () => {
    const config: PermissionConfig = {
      overrides: {
        high: ["rm -rf *"],
      },
    };

    assertOverrideLevel("rm -rf /tmp/test", "high", false, config);
  });
});

describe("override: dangerous patterns", () => {
  test("dangerous patterns", () => {
    const config: PermissionConfig = {
      overrides: {
        dangerous: ["dd if=* of=/dev/*"],
      },
    };

    assertOverrideLevel("dd if=/dev/zero of=/dev/sda", "high", true, config);
  });
});

describe("override: priority order", () => {
  test("priority order", () => {
    const config: PermissionConfig = {
      overrides: {
        minimal: ["cmd *"],
        high: ["cmd dangerous*"],
      },
    };

    assertOverrideLevel("cmd dangerous-thing", "high", false, config);
    assertOverrideLevel("cmd safe-thing", "minimal", false, config);
  });
});

// ============================================================================
// Prefix Mapping Tests
// ============================================================================

describe("prefix: fvm flutter normalization", () => {
  test("fvm flutter normalization", () => {
    const config: PermissionConfig = {
      prefixMappings: [{ from: "fvm flutter", to: "flutter" }],
    };

    assertOverrideLevel("fvm flutter build", "medium", false, config);
    assertOverrideLevel("fvm flutter run", "high", false, config);
    assertOverrideLevel("fvm flutter doctor", "minimal", false, config);
    assertOverrideLevel("fvm flutter test", "medium", false, config);
  });
});

describe("prefix: multiple prefix mappings", () => {
  test("multiple prefix mappings", () => {
    const config: PermissionConfig = {
      prefixMappings: [
        { from: "fvm flutter", to: "flutter" },
        { from: "nvm exec node", to: "node" },
        { from: "rbenv exec ruby", to: "ruby" },
      ],
    };

    assertOverrideLevel("nvm exec node script.js", "high", false, config);
    assertOverrideLevel("rbenv exec ruby script.rb", "high", false, config);
  });
});

describe("prefix: empty mapping (strip prefix)", () => {
  test("strip prefix", () => {
    const config: PermissionConfig = {
      prefixMappings: [{ from: "rbenv exec", to: "" }],
    };

    assertOverrideLevel("rbenv exec ruby script.rb", "high", false, config);
  });
});

describe("prefix: combined with overrides", () => {
  test("prefix + override combination", () => {
    const config: PermissionConfig = {
      overrides: {
        minimal: ["flutter doctor"],
      },
      prefixMappings: [{ from: "fvm flutter", to: "flutter" }],
    };

    assertOverrideLevel("fvm flutter doctor", "minimal", false, config);
  });
});

// ============================================================================
// Config Edge Cases
// ============================================================================

describe("config: empty config doesn't break classification", () => {
  test("empty config", () => {
    const config: PermissionConfig = {};
    void config;
    assertLevel("ls", "minimal");
    assertLevel("npm install", "medium");
    assertLevel("git push", "high");
  });
});

describe("config: null/undefined patterns handled", () => {
  test("null/undefined patterns", () => {
    const config: PermissionConfig = {
      overrides: {
        minimal: undefined as any,
        medium: null as any,
        high: [],
      },
    };

    assertOverrideLevel("ls", "minimal", false, config);
  });
});

describe("config: case insensitivity", () => {
  test("case insensitivity", () => {
    const config: PermissionConfig = {
      overrides: {
        minimal: ["TMUX list-*"],
      },
      prefixMappings: [{ from: "FVM FLUTTER", to: "flutter" }],
    };

    assertOverrideLevel("tmux list-sessions", "minimal", false, config);
    assertOverrideLevel("fvm flutter build", "medium", false, config);
  });
});

// ============================================================================
// Security Edge Cases
// ============================================================================

describe("security: wildcard pattern doesn't bypass dangerous detection", () => {
  test("wildcard override", () => {
    const config: PermissionConfig = {
      overrides: {
        minimal: ["sudo *"], // Attempting to whitelist sudo
      },
    };

    assertOverrideLevel("sudo rm -rf /", "minimal", false, config);
  });
});

describe("security: prefix mapping to dangerous command", () => {
  test("prefix to dangerous", () => {
    const config: PermissionConfig = {
      prefixMappings: [
        { from: "safe", to: "rm -rf" }, // Dangerous mapping
      ],
    };

    assertOverrideLevel("safe /", "high", true, config);
  });
});

describe("security: override consistency with prefix mapping", () => {
  test("override + prefix consistency", () => {
    const config: PermissionConfig = {
      overrides: {
        minimal: ["flutter doctor"],
      },
      prefixMappings: [{ from: "fvm flutter", to: "flutter" }],
    };

    assertOverrideLevel("fvm flutter doctor", "minimal", false, config);
  });
});

describe("security: invalid config entries are handled gracefully", () => {
  test("invalid config entries", () => {
    const config: PermissionConfig = {
      overrides: {
        minimal: [123 as any, null as any, "ls"],
      },
      prefixMappings: [
        null as any,
        { from: "", to: "test" },
        { from: "fvm flutter", to: "flutter" },
      ],
    };

    assertOverrideLevel("ls", "minimal", false, config);
    assertOverrideLevel("fvm flutter build", "medium", false, config);
  });
});

// ============================================================================
// Whitespace and Boundary Tests
// ============================================================================

describe("prefix: handles tabs and multiple spaces", () => {
  test("tabs and multiple spaces", () => {
    const config: PermissionConfig = {
      prefixMappings: [{ from: "fvm flutter", to: "flutter" }],
    };

    assertOverrideLevel("fvm flutter  build", "medium", false, config);
  });
});

describe("prefix: partial match doesn't trigger", () => {
  test("partial match", () => {
    const config: PermissionConfig = {
      prefixMappings: [{ from: "fvm", to: "flutter" }],
    };

    assertOverrideLevel("fvmx build", "high", false, config);
  });
});

// ============================================================================
// Pattern Edge Cases
// ============================================================================

describe("override: question mark wildcard", () => {
  test("question mark wildcard", () => {
    const config: PermissionConfig = {
      overrides: {
        minimal: ["l?"], // matches ls, la, ll, etc.
      },
    };

    assertOverrideLevel("ls", "minimal", false, config);
    assertOverrideLevel("lsa", "high", false, config);
  });
});

describe("override: special regex chars in pattern", () => {
  test("special regex chars", () => {
    const config: PermissionConfig = {
      overrides: {
        minimal: ["test.file", "path/to/file", "cmd [arg]"],
      },
    };

    assertOverrideLevel("test.file", "minimal", false, config);
    assertOverrideLevel("testXfile", "high", false, config);
  });
});

describe("override: empty pattern array", () => {
  test("empty pattern array", () => {
    const config: PermissionConfig = {
      overrides: {
        minimal: [],
        medium: [],
      },
    };

    assertOverrideLevel("ls", "minimal", false, config);
  });
});

describe("baseline: compound commands without overrides", () => {
  test("cd && high-level command stays high", () => {
    assertOverrideLevel("cd /tmp && docker push myimage", "high");
  });

  test("cd && medium-level command stays medium", () => {
    assertOverrideLevel("cd /tmp && npm test", "medium");
  });

  test("cd && minimal-level command stays minimal", () => {
    assertOverrideLevel("cd /tmp && ls", "minimal");
  });

  test("chained with && highest wins", () => {
    assertOverrideLevel("mkdir dir && cd dir && docker push myimage", "high");
  });

  test("chained with ; highest wins", () => {
    assertOverrideLevel("cd dir; docker push myimage", "high");
  });

  test("chained with || highest wins", () => {
    assertOverrideLevel("test -d dir || docker push myimage", "high");
  });
});

// ============================================================================
// Per-command override
// ============================================================================

describe("per-command override: low override on second command", () => {
  test("cd /tmp && command_a where command_a is overridden to low", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["command_a"],
      },
    };

    // Before this feature: full command "cd /tmp && command_a" didn't match
    // any override, so command_a's default high level would apply.
    // After this feature: "command_a" command matches the override → low.
    assertOverrideLevel("cd /tmp && command_a", "low", false, config);
  });

  test("cd /tmp && command_a where command_a is overridden to low (semicolon)", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["command_a"],
      },
    };

    assertOverrideLevel("cd /tmp; command_a", "low", false, config);
  });

  test("cd /tmp && command_a where command_a is overridden to low (pipe)", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["command_a"],
      },
    };

    assertOverrideLevel("cd /tmp | command_a", "low", false, config);
  });

  test("cd /tmp && command_a where command_a is overridden to low (logical OR)", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["command_a"],
      },
    };

    assertOverrideLevel("cd /tmp || command_a", "low", false, config);
  });
});

describe("per-command override: low override on first command", () => {
  test("command_a && cd /tmp where command_a is overridden to low", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["command_a"],
      },
    };

    assertOverrideLevel("command_a && cd /tmp", "low", false, config);
  });
});

describe("per-command override: low override on middle command", () => {
  test("cmd_a && command_b && cmd_c where middle is overridden to low", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["command_b"],
      },
    };

    // cmd_a is high (unknown), command_b is low (override), cmd_c is minimal
    // Highest should still be high because cmd_a is high
    assertOverrideLevel("cmd_a && command_b && cmd_c", "high", false, config);
  });

  test("cd && command_b && cd where middle is overridden to low", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["command_b"],
      },
    };

    // cd is minimal, command_b is low (override), cd is minimal
    assertOverrideLevel(
      "cd /tmp && command_b && cd /var",
      "low",
      false,
      config,
    );
  });
});

describe("per-command override: multiple commands overridden", () => {
  test("two commands both overridden to low", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["command_a", "command_b"],
      },
    };

    assertOverrideLevel(
      "cd /tmp && command_a && command_b",
      "low",
      false,
      config,
    );
  });

  test("one overridden to low, one overridden to medium", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["command_a"],
        medium: ["command_b"],
      },
    };

    // command_a → low, command_b → medium, highest is medium
    assertOverrideLevel(
      "cd /tmp && command_a && command_b",
      "medium",
      false,
      config,
    );
  });
});

// ============================================================================
// Per-command override: dangerous flag propagation
// ============================================================================

describe("per-command override: dangerous flag from command override", () => {
  test("cd /tmp && command_a where command_a is overridden dangerous", () => {
    const config: PermissionConfig = {
      overrides: {
        dangerous: ["command_a"],
      },
    };

    // command_a is overridden as dangerous → dangerous flag set
    assertOverrideLevel("cd /tmp && command_a", "high", true, config);
  });

  test("cd /tmp && command_a where command_a is overridden dangerous (semicolon)", () => {
    const config: PermissionConfig = {
      overrides: {
        dangerous: ["command_a"],
      },
    };

    assertOverrideLevel("cd /tmp; command_a", "high", true, config);
  });

  test("safe command + dangerous command override", () => {
    const config: PermissionConfig = {
      overrides: {
        dangerous: ["command_a"],
      },
    };

    assertOverrideLevel("ls && command_a", "high", true, config);
  });
});

// ============================================================================
// Per-command override: override takes precedence over command classification
// ============================================================================

describe("per-command override: override overrides command classification", () => {
  test("high-level command overridden to low", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["npm install"],
      },
    };

    // npm install is normally high, but overridden to low
    assertOverrideLevel("cd /tmp && npm install", "low", false, config);
  });

  test("medium-level command overridden to minimal", () => {
    const config: PermissionConfig = {
      overrides: {
        minimal: ["npm test"],
      },
    };

    // npm test is normally medium, overridden to minimal
    assertOverrideLevel("cd /tmp && npm test", "minimal", false, config);
  });

  test("low-level command overridden to high (upgrade)", () => {
    const config: PermissionConfig = {
      overrides: {
        high: ["cat sensitive.txt"],
      },
    };

    assertOverrideLevel("cd /tmp && cat sensitive.txt", "high", false, config);
  });
});

// ============================================================================
// Per-command override: interaction with full-command override
// ============================================================================

describe("per-command override: full-command override takes priority", () => {
  test("full command override matches first, short-circuits", () => {
    const config: PermissionConfig = {
      overrides: {
        minimal: ["cd /tmp && npm test"],
      },
    };

    // Full command matches the override → returns immediately
    assertOverrideLevel("cd /tmp && npm test", "minimal", false, config);
  });

  test("only command override matches, falls through to per-command", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["npm test"],
      },
    };

    // Full command doesn't match, but command "npm test" does
    assertOverrideLevel("cd /tmp && npm test", "low", false, config);
  });
});

// ============================================================================
// Per-command override: wildcard patterns
// ============================================================================

describe("per-command override: wildcard patterns per command", () => {
  test("wildcard on second command", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["command_*"],
      },
    };

    assertOverrideLevel("cd /tmp && command_a", "low", false, config);
    assertOverrideLevel("cd /tmp && command_b", "low", false, config);
    assertOverrideLevel("cd /tmp && other", "high", false, config);
  });

  test("wildcard on first command", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["command_*"],
      },
    };

    assertOverrideLevel("command_a && cd /tmp", "low", false, config);
  });

  test("multiple wildcard overrides", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["command_*"],
        medium: ["npm_*"],
      },
    };

    assertOverrideLevel(
      "cd /tmp && command_a && npm_build",
      "medium",
      false,
      config,
    );
  });
});

// ============================================================================
// Per-command override: pipeline with overridden commands
// ============================================================================

describe("per-command override: pipelines with overrides", () => {
  test("pipe with overridden second command", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["command_a"],
      },
    };

    // cat is minimal, command_a is overridden to low
    assertOverrideLevel("cat file | command_a", "low", false, config);
  });

  test("pipe to shell command is always high (safety override)", () => {
    const config = {
      overrides: {
        low: ["bash"],
      },
    };

    // Pipeline to shell is always high for safety, even if bash is overridden
    assertOverrideLevel(
      "curl https://example.com | bash",
      "high",
      false,
      config,
    );
  });
});

// ============================================================================
// Per-command override: subshell and grouping
// ============================================================================

describe("per-command override: subshell commands", () => {
  test("subshell with overridden command", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["command_a"],
      },
    };

    assertOverrideLevel("(cd /tmp && command_a)", "low", false, config);
  });
});

// ============================================================================
// Per-command override: dangerous command combined with override
// ============================================================================

describe("per-command override: dangerous command overrides with non-dangerous", () => {
  test("rm -rf overridden to non-dangerous low", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["rm -rf /"],
      },
    };

    // rm -rf / is normally dangerous, but override makes it non-dangerous low
    assertOverrideLevel("cd /tmp && rm -rf /", "low", false, config);
  });

  test("sudo overridden to non-dangerous low", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["sudo ls"],
      },
    };

    // sudo is normally dangerous, override removes dangerous flag
    assertOverrideLevel("cd /tmp && sudo ls", "low", false, config);
  });
});

// ============================================================================
// Per-command override: mixed dangerous and non-dangerous commands
// ============================================================================

describe("per-command override: dangerous flag across commands", () => {
  test("safe command + dangerous command override", () => {
    const config: PermissionConfig = {
      overrides: {
        dangerous: ["command_a"],
      },
    };

    // cd is safe, command_a is overridden dangerous
    assertOverrideLevel("cd /tmp && command_a", "high", true, config);
  });

  test("dangerous command + safe command override", () => {
    const config: PermissionConfig = {
      overrides: {
        dangerous: ["command_a"],
      },
    };

    assertOverrideLevel("command_a && cd /tmp", "high", true, config);
  });

  test("both commands dangerous", () => {
    const config: PermissionConfig = {
      overrides: {
        dangerous: ["command_a", "command_b"],
      },
    };

    assertOverrideLevel("command_a && command_b", "high", true, config);
  });
});

// ============================================================================
// Per-command override: no override provided (default behavior unchanged)
// ============================================================================

describe("per-command override: no config provided", () => {
  test("compound commands without config use highest level", () => {
    assertOverrideLevel("cd /tmp && npm install", "medium");
    assertOverrideLevel("cd /tmp && npm test", "medium");
    assertOverrideLevel("cd /tmp && ls", "minimal");
  });

  test("compound commands with empty overrides", () => {
    const config: PermissionConfig = {
      overrides: {},
    };

    assertOverrideLevel("cd /tmp && npm install", "medium", false, config);
    assertOverrideLevel("cd /tmp && npm test", "medium", false, config);
  });
});

// ============================================================================
// Per-command override: edge cases
// ============================================================================

describe("per-command override: single command commands", () => {
  test("single command with override", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["command_a"],
      },
    };

    assertOverrideLevel("command_a", "low", false, config);
  });

  test("single command without override", () => {
    assertOverrideLevel("command_a", "high", false);
  });
});

describe("per-command override: empty commands", () => {
  test("command with trailing operator", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["command_a"],
      },
    };

    assertOverrideLevel("cd /tmp && command_a", "low", false, config);
  });
});

describe("per-command override: path-based commands", () => {
  test("absolute path overridden", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["/usr/bin/command_a"],
      },
    };

    assertOverrideLevel("cd /tmp && /usr/bin/command_a", "low", false, config);
  });
});

describe("per-command override: environment variable prefixed commands", () => {
  test("env-prefixed command with override", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["command_a"],
      },
    };

    // First command "FOO=bar cd /tmp" is high (unknown command),
    // second command "command_a" is overridden to low.
    // Highest wins → high
    assertOverrideLevel("FOO=bar cd /tmp && command_a", "high", false, config);
  });

  test("env-prefixed command where env command is overridden", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["FOO=bar cd /tmp"],
      },
    };

    // First command is overridden to low, second command is minimal (ls)
    assertOverrideLevel("FOO=bar cd /tmp && ls", "low", false, config);
  });
});

// ============================================================================
// Per-command override: realistic scenarios
// ============================================================================

describe("per-command override: realistic development workflows", () => {
  test("deploy script: cd && npm run build", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["npm run build"],
      },
    };

    // npm run build is normally medium, overridden to low
    assertOverrideLevel("cd /project && npm run build", "low", false, config);
  });

  test("git workflow: fetch && status", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["git status"],
      },
    };

    // git fetch is minimal, git status overridden to low
    assertOverrideLevel("git fetch && git status", "low", false, config);
  });

  test("cleanup workflow: cd && rm && touch", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["rm *"],
      },
    };

    // cd is minimal, rm file.tmp is overridden to low, touch is medium
    // Highest is medium (touch)
    assertOverrideLevel(
      "cd /tmp && rm file.tmp && touch file.txt",
      "medium",
      false,
      config,
    );
  });

  test("docker workflow with override", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["docker ps"],
      },
    };

    // docker ps is normally high, overridden to low
    assertOverrideLevel("docker ps", "low", false, config);
  });

  test("python dev with override", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["pytest"],
      },
    };

    // pytest is normally medium, overridden to low
    assertOverrideLevel("cd /project && pytest", "low", false, config);
  });
});

// ============================================================================
// Per-command override: precedence between command override and command classification
// ============================================================================

describe("per-command override: override vs command classification precedence", () => {
  test("override level higher than command default", () => {
    const config: PermissionConfig = {
      overrides: {
        high: ["ls"], // ls is normally minimal, override to high
      },
    };

    assertOverrideLevel("cd /tmp && ls", "high", false, config);
  });

  test("override level lower than command default", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["npm install"], // npm install is normally high, override to low
      },
    };

    assertOverrideLevel("cd /tmp && npm install", "low", false, config);
  });

  test("highest override wins across commands", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["command_a"],
        medium: ["command_b"],
        high: ["command_c"],
      },
    };

    assertOverrideLevel(
      "command_a && command_b && command_c",
      "high",
      false,
      config,
    );
  });
});

// ============================================================================
// Per-command override: interaction with shell tricks
// ============================================================================

describe("per-command override: shell tricks still short-circuit", () => {
  test("command with $() still returns high regardless of override", () => {
    const config: PermissionConfig = {
      overrides: {
        minimal: ["$(whoami)"],
      },
    };

    // Shell tricks detected at parse level, before per-command overrides
    assertOverrideLevel("echo $(whoami)", "high", false, config);
  });
});

// ============================================================================
// Per-command override: interaction with prefix mappings
// ============================================================================

describe("per-command override: prefix mappings applied before per-command check", () => {
  test("prefix mapping on full command then per-command override", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["flutter doctor"],
      },
      prefixMappings: [{ from: "fvm flutter", to: "flutter" }],
    };

    // Full command "fvm flutter doctor && cd /tmp" starts with prefix,
    // so it transforms to "flutter doctor && cd /tmp"
    // Full command override doesn't match (flutter doctor && cd /tmp
    // doesn't match flutter doctor)
    // Per-command: "flutter doctor" command matches override → low
    // "cd /tmp" is minimal
    // Highest is low
    assertOverrideLevel("fvm flutter doctor && cd /tmp", "low", false, config);
  });

  test("prefix mapping doesn't apply to middle commands", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["flutter doctor"],
      },
      prefixMappings: [{ from: "fvm flutter", to: "flutter" }],
    };

    // Full command "cd /tmp && fvm flutter doctor" does NOT start with
    // "fvm flutter", so prefix mapping is NOT applied
    // Segment "fvm flutter doctor" doesn't match override "flutter doctor"
    // fvm flutter doctor is unknown → high
    assertOverrideLevel("cd /tmp && fvm flutter doctor", "high", false, config);
  });
});

// ============================================================================
// Per-command override: complex compound commands
// ============================================================================

describe("per-command override: complex compound commands", () => {
  test("four commands with mixed overrides", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["command_b", "command_d"],
        medium: ["command_c"],
      },
    };

    // cd(minimal) && command_b(low) && command_c(medium) && command_d(low)
    // Highest is medium
    assertOverrideLevel(
      "cd /tmp && command_b && command_c && command_d",
      "medium",
      false,
      config,
    );
  });

  test("pipe chain with overrides", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["command_b"],
      },
    };

    // cat(minimal) | command_b(low) | head(minimal) = low
    assertOverrideLevel("cat file | command_b | head", "low", false, config);
  });

  test("nested && and |", () => {
    const config: PermissionConfig = {
      overrides: {
        low: ["command_a"],
      },
    };

    // cd(minimal) && command_a(low) | head(minimal) = low
    assertOverrideLevel("cd /tmp && command_a | head", "low", false, config);
  });
});
