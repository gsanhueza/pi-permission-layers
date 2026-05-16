/**
 * Medium level classification - dev ops, builds, tests, package installs
 */

import { getCommandName } from "./index";

const MEDIUM_PACKAGE_PATTERNS: Array<[string, RegExp]> = [
  [
    "npm",
    /^(install|ci|add|remove|uninstall|update|rebuild|dedupe|prune|link|pack|test|build)$/,
  ],
  ["yarn", /^(install|add|remove|upgrade|import|link|pack|test|build)$/],
  ["pnpm", /^(install|add|remove|update|link|pack|test|build)$/],
  ["bun", /^(install|add|remove|update|link|test|build)$/],
  ["pip", /^install$/],
  ["pip3", /^install$/],
  ["pipenv", /^(install|update|sync|lock|uninstall)$/],
  ["poetry", /^(install|add|remove|update|lock|build)$/],
  ["conda", /^(install|update|remove|create)$/],
  ["uv", /^(pip|sync|lock)$/],
  ["pytest", /./],
  [
    "cargo",
    /^(install|add|remove|fetch|update|build|test|check|clippy|fmt|doc|bench|clean)$/,
  ],
  ["rustfmt", /./],
  ["rustc", /./],
  ["go", /^(get|mod|build|test|generate|fmt|vet|clean|install)$/],
  ["gem", /^install$/],
  ["bundle", /^(install|update|add|remove|binstubs)$/],
  ["bundler", /^(install|update|add|remove)$/],
  ["pod", /^(install|update|repo)$/],
  ["rspec", /./],
  ["composer", /^(install|require|remove|update|dump-autoload)$/],
  ["phpunit", /./],
  ["mvn", /^(install|compile|test|package|clean|dependency|verify)$/],
  ["gradle", /^(build|test|clean|assemble|dependencies|check)$/],
  ["dotnet", /^(restore|add|build|test|clean|publish|pack|new)$/],
  ["nuget", /^install$/],
  ["dart", /^(pub|compile|test|analyze|format|fix)$/],
  ["flutter", /^(pub|build|test|analyze|clean|create|doctor)$/],
  ["pub", /^(get|upgrade|downgrade|cache|deps)$/],
  ["swift", /^(package|build|test)$/],
  ["swiftc", /./],
  ["mix", /^(deps|compile|test|ecto|phx\.gen)$/],
  ["cabal", /^(install|build|test|update)$/],
  ["stack", /^(install|build|test|setup)$/],
  ["ghc", /./],
  ["nimble", /^install$/],
  ["zig", /^(build|test|fetch)$/],
  ["cmake", /./],
  ["make", /./],
  ["ninja", /./],
  ["meson", /./],
  ["eslint", /./],
  ["prettier", /./],
  ["black", /./],
  ["flake8", /./],
  ["pylint", /./],
  ["ruff", /./],
  ["pyflakes", /./],
  ["bandit", /./],
  ["mypy", /./],
  ["pyright", /./],
  ["tsc", /./],
  ["tslint", /./],
  ["standard", /./],
  ["xo", /./],
  ["rubocop", /./],
  ["standardrb", /./],
  ["reek", /./],
  ["brakeman", /./],
  ["golangci-lint", /./],
  ["gofmt", /./],
  ["go vet", /./],
  ["golint", /./],
  ["staticcheck", /./],
  ["errcheck", /./],
  ["misspell", /./],
  ["swiftlint", /./],
  ["swiftformat", /./],
  ["ktlint", /./],
  ["detekt", /./],
  ["dartanalyzer", /./],
  ["dartfmt", /./],
  ["clang-tidy", /./],
  ["clang-format", /./],
  ["cppcheck", /./],
  ["checkstyle", /./],
  ["pmd", /./],
  ["spotbugs", /./],
  ["sonarqube", /./],
  ["phpcs", /./],
  ["phpmd", /./],
  ["phpstan", /./],
  ["psalm", /./],
  ["php-cs-fixer", /./],
  ["luacheck", /./],
  ["shellcheck", /./],
  ["checkov", /./],
  ["tflint", /./],
  ["buf", /./],
  ["sqlfluff", /./],
  ["yamllint", /./],
  ["markdownlint", /./],
  ["djlint", /./],
  ["djhtml", /./],
  ["commitlint", /./],
  ["jest", /./],
  ["mocha", /./],
  ["vitest", /./],
  ["mkdir", /./],
  ["touch", /./],
  ["cp", /./],
  ["mv", /./],
  ["ln", /./],
  ["prisma", /^(generate|migrate|db|studio)$/],
  ["sequelize", /^(db|migration)$/],
  ["typeorm", /^(migration)$/],
];

const MEDIUM_GIT_SUBCOMMANDS = new Set([
  "add",
  "commit",
  "pull",
  "checkout",
  "switch",
  "branch",
  "merge",
  "rebase",
  "cherry-pick",
  "stash",
  "revert",
  "tag",
  "rm",
  "mv",
  "reset",
  "clone",
]);

const SAFE_RUN_SCRIPTS = new Set([
  "build",
  "compile",
  "test",
  "lint",
  "format",
  "fmt",
  "check",
  "typecheck",
  "type-check",
  "types",
  "validate",
  "verify",
  "prepare",
  "prepublish",
  "prepublishOnly",
  "prepack",
  "postpack",
  "clean",
  "lint:fix",
  "format:check",
  "build:prod",
  "build:dev",
  "build:production",
  "build:development",
  "test:unit",
  "test:integration",
  "test:e2e",
  "test:coverage",
]);

const UNSAFE_RUN_SCRIPTS = new Set([
  "start",
  "dev",
  "develop",
  "serve",
  "server",
  "watch",
  "preview",
  "start:dev",
  "start:prod",
  "dev:server",
]);

// ============================================================================
// HELPERS
// ============================================================================

const isSafeRunScript = (script: string): boolean => {
  const s = script.toLowerCase();
  if (SAFE_RUN_SCRIPTS.has(s)) return true;
  if (
    s.startsWith("build") ||
    s.startsWith("test") ||
    s.startsWith("lint") ||
    s.startsWith("format") ||
    s.startsWith("check") ||
    s.startsWith("type")
  ) {
    return true;
  }
  if (UNSAFE_RUN_SCRIPTS.has(s)) return false;
  if (
    s.startsWith("start") ||
    s.startsWith("dev") ||
    s.startsWith("serve") ||
    s.startsWith("watch")
  ) {
    return false;
  }
  return false;
};

// ============================================================================
// LEVEL CHECK
// ============================================================================

export const isMediumLevel = (tokens: string[]): boolean => {
  if (tokens.length === 0) return false;

  const cmd = getCommandName(tokens);
  const subCmd = tokens.length > 1 ? tokens[1].toLowerCase() : "";
  const thirdArg = tokens.length > 2 ? tokens[2] : "";

  if (cmd === "git") {
    if (subCmd === "push") return false;
    if (subCmd === "reset" && tokens.includes("--hard")) return false;
    if (MEDIUM_GIT_SUBCOMMANDS.has(subCmd)) return true;
  }

  if (["npm", "yarn", "pnpm", "bun"].includes(cmd) && subCmd === "run") {
    if (!thirdArg || thirdArg.startsWith("-")) return false;
    return isSafeRunScript(thirdArg);
  }

  for (const [pattern, subPattern] of MEDIUM_PACKAGE_PATTERNS) {
    if (cmd === pattern) {
      if (!subCmd || subPattern.test(subCmd)) {
        return true;
      }
    }
  }

  return false;
};
