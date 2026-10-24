/**
 * Keeps kernel permission work from overlapping the kernel-wide nonce change.
 *
 * Retiring a legacy card grant raises the wallet's `validNonceFrom` floor. That
 * kills every non-root permission that was installed below it, including an
 * enable signature another flow just made and has not sent yet. So the two
 * must never run together, in either order:
 *
 *  - a signing session (a scoped permission grant, or a one-use spend session)
 *    holds the guard from before its passkey prompt until it is finished;
 *  - the migration refuses to start while any session is open, and holds the
 *    guard alone until it is confirmed;
 *  - a session that tries to start during the migration is refused.
 *
 * A session that is never released (a path that forgot to dispose) frees
 * itself after `maxHoldMs`, the lifetime of what it signed.
 */

export class KernelSigningBusyError extends Error {
    constructor(readonly reason: 'migration-running' | 'signing-open') {
        super(
            reason === 'migration-running'
                ? 'A card permission update is running — try again in a moment'
                : 'Another card signature is in progress — try again in a moment'
        )
        this.name = 'KernelSigningBusyError'
    }
}

const openSessions = new Set<symbol>()
let migrationRunning = false

const hold = (token: symbol, maxHoldMs: number): (() => void) => {
    const timer = setTimeout(() => openSessions.delete(token), maxHoldMs)
    return () => {
        clearTimeout(timer)
        openSessions.delete(token)
    }
}

/** Marks a signing session open. Throws `KernelSigningBusyError` during a migration. Returns an idempotent release. */
export function beginKernelSigning(maxHoldMs = 10 * 60_000): () => void {
    if (migrationRunning) throw new KernelSigningBusyError('migration-running')
    const token = Symbol('kernel-signing')
    openSessions.add(token)
    return hold(token, maxHoldMs)
}

/** Marks the migration running. Throws `KernelSigningBusyError` while any signing session is open. Returns an idempotent release. */
export function beginKernelMigration(): () => void {
    if (migrationRunning) throw new KernelSigningBusyError('migration-running')
    if (openSessions.size > 0) throw new KernelSigningBusyError('signing-open')
    migrationRunning = true
    let released = false
    return () => {
        if (released) return
        released = true
        migrationRunning = false
    }
}
