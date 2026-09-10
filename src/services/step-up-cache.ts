/** Retire the token early so a request never leaves with one about to expire. */
const EXPIRY_MARGIN_MS = 30_000

let cached: { token: string; expiresAt: number } | null = null

export function getCachedStepUpToken(): string | null {
    if (cached && cached.expiresAt - EXPIRY_MARGIN_MS > Date.now()) return cached.token
    cached = null
    return null
}

export function setCachedStepUpToken(token: string, expiresIn: number): void {
    cached = { token, expiresAt: Date.now() + expiresIn * 1000 }
}

export function clearCachedStepUpToken(): void {
    cached = null
}
