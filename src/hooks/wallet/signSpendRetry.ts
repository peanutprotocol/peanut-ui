// Artifact ownership stays client-side and never enters the signed wire payload.
const ephemeralAccounts = new WeakMap<object, string>()
const passkeyAccounts = new Set<string>()
const storageKey = (account: string) => `peanut:sign-spend-passkey:${account.toLowerCase()}`

export function registerEphemeralArtifact<T extends object>(artifact: T, account: string): T {
    ephemeralAccounts.set(artifact, account.toLowerCase())
    return artifact
}

export function requiresPasskeyRetry(account: string): boolean {
    const normalized = account.toLowerCase()
    if (passkeyAccounts.has(normalized)) return true
    try {
        return sessionStorage.getItem(storageKey(normalized)) === 'true'
    } catch {
        return false
    }
}

// These are the confirmed-revert messages from the withdraw and QR
// broadcasters. Timeouts and transport failures may still move funds.
function isConfirmedRevert(failure: unknown): boolean {
    if (!failure || typeof failure !== 'object') return false
    const { message, error, code } = failure as { message?: unknown; error?: unknown; code?: unknown }
    const detail = typeof message === 'string' ? message : error
    return (
        code === 'USER_OP_REVERTED' ||
        error === 'USER_OP_REVERTED' ||
        (typeof detail === 'string' && detail.startsWith('USER_OP_REVERTED:'))
    )
}

function recordFailure(artifact: object, failure: unknown): void {
    const account = ephemeralAccounts.get(artifact)
    if (!account || !isConfirmedRevert(failure)) return
    passkeyAccounts.add(account)
    try {
        sessionStorage.setItem(storageKey(account), 'true')
    } catch {
        // The in-memory guard still covers retries if storage is unavailable.
    }
}

function notifyFailure(onFailure: ((failure: unknown) => void) | undefined, failure: unknown): void {
    try {
        onFailure?.(failure)
    } catch {
        // The submission's own outcome is the contract here.
    }
}

/**
 * `onFailure` observes a failed submission (thrown, or a resolved value that
 * IS a confirmed revert) so the caller can repair side state — the cached Rain
 * controller. A pending/successful result is not a failure, and the callback
 * never changes the returned value or the thrown error.
 */
export async function submitSignedSpend<T>(
    artifact: object,
    submit: () => Promise<T>,
    onFailure?: (failure: unknown) => void
): Promise<T> {
    try {
        const result = await submit()
        recordFailure(artifact, result)
        if (isConfirmedRevert(result)) notifyFailure(onFailure, result)
        return result
    } catch (error) {
        recordFailure(artifact, error)
        notifyFailure(onFailure, error)
        throw error
    }
}
