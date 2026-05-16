/**
 * High level classification - network, deployment, dangerous shell execution
 */

import { getCommandName } from "./index";

// ============================================================================
// LEVEL CHECK
// ============================================================================

export const isHighLevel = (tokens: string[]): boolean => {
  if (tokens.length === 0) return false;

  const cmd = getCommandName(tokens);
  const subCmd = tokens.length > 1 ? tokens[1].toLowerCase() : "";
  const argsStr = tokens.slice(1).join(" ");

  if (cmd === "git" && subCmd === "push") return true;
  if (cmd === "git" && subCmd === "reset" && tokens.includes("--hard"))
    return true;
  if (cmd === "curl" || cmd === "wget") return true;

  if (cmd === "bash" || cmd === "sh" || cmd === "zsh") {
    if (argsStr.includes("http://") || argsStr.includes("https://"))
      return true;
  }

  if (cmd === "docker" && ["push", "login", "logout"].includes(subCmd))
    return true;

  if (["kubectl", "helm", "terraform", "pulumi", "ansible"].includes(cmd))
    return true;
  if (["ssh", "scp", "rsync"].includes(cmd)) return true;

  return false;
};
