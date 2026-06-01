import { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { execFile } from "node:child_process";
import { getCachedConfig } from "../../core/config";
import type { PermissionLevel } from "../../core/types";
import { LEVEL_INFO } from "../../core/types";

// ============================================================================
// COLOR CODES
// ============================================================================

const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const GREEN = "\x1b[32m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";

const LEVEL_COLORS: Record<PermissionLevel, string> = {
  minimal: RED,
  low: YELLOW,
  medium: CYAN,
  high: GREEN,
  bypassed: DIM,
};

export const getStatusText = (level: PermissionLevel): string => {
  const info = LEVEL_INFO[level];
  const color = LEVEL_COLORS[level];
  return `${BOLD}${color}${info.label}${RESET} ${DIM}- ${info.desc}${RESET}`;
};

// ============================================================================
// MODE DETECTION
// ============================================================================

export const isQuietMode = (_ctx: ExtensionContext): boolean => {
  const envQuiet = process.env.PI_QUIET?.toLowerCase();
  if (envQuiet && ["1", "true", "yes"].includes(envQuiet)) return true;

  if (process.argv.includes("--quiet") || process.argv.includes("-q"))
    return true;

  return isQuietStartupFromSettings();
};

const isQuietStartupFromSettings = (): boolean => {
  const settings = getCachedConfig();
  return settings.quietStartup === true;
};

// ============================================================================
// TERMINAL FOCUS DETECTION
// ============================================================================

const detectTerminalBundleId = (): string | null => {
  const bundleId = process.env.__CFBundleIdentifier;
  if (bundleId) return bundleId;

  if (process.env.GHOSTTY_RESOURCES_DIR) return "com.mitchellh.ghostty";
  if (process.env.ITERM_SESSION_ID) return "com.googlecode.iterm2";
  if (process.env.KITTY_PID) return "net.kovidgoyal.kitty";
  if (process.env.ALACRITTY_WINDOW_ID) return "org.alacritty";
  if (process.env.WARP_IS_LOCAL_SHELL_SESSION) return "dev.warp.Warp-Stable";
  if (process.env.TERM_PROGRAM === "Apple_Terminal")
    return "com.apple.Terminal";
  if (process.env.TERM_PROGRAM === "vscode") return "com.microsoft.VSCode";

  return null;
};

let _terminalBundleId: string | null | undefined;
const getTerminalBundleId = (): string | null => {
  if (_terminalBundleId === undefined) {
    _terminalBundleId = detectTerminalBundleId();
  }
  return _terminalBundleId;
};

const isTmux = (): boolean => {
  return !!process.env.TMUX;
};

const isAppFocused = async (): Promise<boolean> => {
  if (process.platform !== "darwin") return true;

  const bundleId = getTerminalBundleId();
  if (!bundleId) return true;

  return new Promise((resolve) => {
    execFile(
      "osascript",
      [
        "-e",
        'tell application "System Events" to return bundle identifier of first application process whose frontmost is true',
      ],
      { timeout: 500 },
      (err, stdout) => {
        if (err) {
          resolve(true);
          return;
        }
        resolve(stdout.trim() === bundleId);
      },
    );
  });
};

const isTerminalFocused = async (): Promise<boolean> => {
  if (isTmux()) {
    return new Promise((resolve) => {
      execFile(
        "tmux",
        ["display-message", "-p", "#{pane_active}"],
        { timeout: 500 },
        (err, stdout) => {
          if (err || stdout.trim() !== "1") {
            resolve(false);
            return;
          }
          resolve(isAppFocused());
        },
      );
    });
  }

  return isAppFocused();
};

// ============================================================================
// SYSTEM NOTIFICATIONS
// ============================================================================

export const notifySystem = async (
  title: string,
  message: string,
): Promise<void> => {
  const config = getCachedConfig();
  const focused = await isTerminalFocused();

  if (config.systemNotifications === "off") return;
  if (config.systemNotifications === "unfocused" && focused) return;

  try {
    if (process.platform === "darwin") {
      const bundleId = getTerminalBundleId();
      const tnArgs = ["-title", title, "-message", message];
      if (bundleId) tnArgs.push("-activate", bundleId);

      execFile("terminal-notifier", tnArgs, () => {});
    } else if (process.platform === "linux") {
      const args = ["-a", "pi-permission-layers", title, message];

      if (config.systemNotifications === "persistent")
        args.push("-u", "critical");

      execFile("notify-send", args);
    }
  } catch {
    // Silently fail if notifications unavailable
  }
};
