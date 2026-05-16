export type PermissionLevel =
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "bypassed";

export type PermissionMode = "ask" | "block";

export const LEVELS: PermissionLevel[] = [
  "minimal",
  "low",
  "medium",
  "high",
  "bypassed",
];
export const PERMISSION_MODES: PermissionMode[] = ["ask", "block"];

export const LEVEL_INDEX: Record<PermissionLevel, number> = {
  minimal: 0,
  low: 1,
  medium: 2,
  high: 3,
  bypassed: 4,
};

export const LEVEL_INFO: Record<
  PermissionLevel,
  { label: string; desc: string }
> = {
  minimal: { label: "Minimal", desc: "Read-only" },
  low: { label: "Low", desc: "File ops only" },
  medium: { label: "Medium", desc: "Dev operations" },
  high: { label: "High", desc: "Full operations" },
  bypassed: { label: "Bypassed", desc: "All checks disabled" },
};

export const PERMISSION_MODE_INFO: Record<
  PermissionMode,
  { label: string; desc: string }
> = {
  ask: { label: "Ask", desc: "Prompt when permission is required" },
  block: { label: "Block", desc: "Block instead of prompting" },
};

export type Notification = "off" | "on" | "unfocused" | "persistent";
