/**
 * Shared tool permission decision tree.
 *
 * Both no-ui and ui layers use this for the classify → dangerous → level
 * permission-check sequence. Each layer wraps it with its own
 * `requestPermission` call.
 */

import type { Classification, PermissionState } from "../../core/interfaces";
import { LEVEL_INDEX } from "../../core/types";

interface ClassifyAndCheckResult {
  /** `true` if the tool is blocked at this point (caller should return early). */
  blocked: boolean;
  /** Reason string if blocked, undefined if the caller should proceed to `requestPermission`. */
  reason?: string;
  /** The resolved classification, or `null` if the tool is unknown. */
  classification: Classification | null;
}

/**
 * Core decision tree for tool permission checks.
 *
 * 1. Unknown tool → block
 * 2. Dangerous tool → block (caller handles the dangerous prompt)
 * 3. Level sufficient → allow
 * 4. Otherwise → caller should invoke `requestPermission`
 *
 * @returns A result indicating whether to block, or that the caller should
 *          proceed to `requestPermission`.
 */
export const classifyAndCheck = (
  state: PermissionState,
  classification: Classification | null,
): ClassifyAndCheckResult => {
  if (!classification) {
    return {
      blocked: true,
      reason: `[pi-permission-layers] Unknown tool requires High permission`,
      classification: null,
    };
  }

  if (classification.dangerous) {
    return {
      blocked: true,
      reason: `dangerous`,
      classification,
    };
  }

  if (LEVEL_INDEX[state.currentLevel] >= LEVEL_INDEX[classification.level]) {
    return { blocked: false, classification };
  }

  return { blocked: false, classification };
};
