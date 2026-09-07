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

function recordFailure(artifact: object, failure: unknown): void {
    const account = ephemeralAccounts.get(artifact)
    if (!account || !failure || typeof failure !== 'object') return
    const { message, error, code } = failure as { message?: unknown; error?: unknown; code?: unknown }
    const detail = typeof message === 'string' ? message : error
    // These are the confirmed-revert messages from the withdraw and QR
    // broadcasters. Timeouts and transport failures may still move funds.
    if (
        code !== 'USER_OP_REVERTED' &&
        error !== 'USER_OP_REVERTED' &&
        (typeof detail !== 'string' || !detail.startsWith('USER_OP_REVERTED:'))
    )
        return
    passkeyAccounts.add(account)
    try {
        sessionStorage.setItem(storageKey(account), 'true')
    } catch {
        // The in-memory guard still covers retries if storage is unavailable.
    }
}

export async function submitSignedSpend<T>(artifact: object, submit: () => Promise<T>): Promise<T> {
    try {
        const result = await submit()
        recordFailure(artifact, result)
        return result
    } catch (error) {
        recordFailure(artifact, error)
        throw error
    }
}
