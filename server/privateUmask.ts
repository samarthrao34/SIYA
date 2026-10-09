/**
 * Imported first by server/index.ts: everything the backend creates in the
 * data folder (settings, memories, cognition state, logs, the key file) is
 * readable only by the user's own account. Files written in place are also
 * chmodded by their writers, since the umask applies only at creation.
 *
 * Child processes that create files *for* the user (the desktop agent's
 * "create file", "save screenshot" tools) get the original umask back via
 * withOriginalUmask, so those files keep the user's normal permissions.
 */
export const ORIGINAL_UMASK = process.umask(0o077);

export function withOriginalUmask<T>(fn: () => T): T {
  process.umask(ORIGINAL_UMASK);
  try {
    return fn();
  } finally {
    process.umask(0o077);
  }
}
