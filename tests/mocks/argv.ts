/**
 * Argv manipulation utility for tests.
 */

/**
 * Temporarily replace process.argv, run a callback, then restore.
 */
export function withArgv<T>(argv: string[], fn: () => T): T {
  const originalArgv = process.argv;
  process.argv = argv;
  try {
    return fn();
  } finally {
    process.argv = originalArgv;
  }
}
