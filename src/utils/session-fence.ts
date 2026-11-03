import { authReady, getAuthToken, getClearEpoch, tokenUserId } from './auth-token'
import { isDemoMode } from './demo'
import { peekActiveFixture } from '@/dev/fixtures/active'

export interface SessionFence {
    readonly userId: string | null
    /** Present only when a missing token needs session hydration. */
    ready?: Promise<void>
    current: () => boolean
}

/** Unknown JS identity is supported by the API's legacy cookie-auth path. */
export function captureSessionFence(
    expectedUserId?: string,
    active: () => boolean = () => true,
    unavailable?: () => void
): SessionFence {
    const demo = isDemoMode()
    const fixture = demo ? null : peekActiveFixture()
    const synthetic = demo || !!fixture
    let userId = demo ? 'demo-user' : fixture ? (expectedUserId ?? 'demo-user') : tokenUserId(getAuthToken())
    const epoch = getClearEpoch()
    let failed = false
    const current = () => {
        if (
            failed ||
            !active() ||
            getClearEpoch() !== epoch ||
            isDemoMode() !== demo ||
            (!demo && peekActiveFixture() !== fixture)
        )
            return false
        if (synthetic) return true
        const now = tokenUserId(getAuthToken())
        // A readable identity must stay readable and match. With cookie-only
        // auth, reject any newly observed identity that contradicts the profile.
        return userId
            ? now === userId && (!expectedUserId || now === expectedUserId)
            : !now || !expectedUserId || now === expectedUserId
    }
    const fence: SessionFence = {
        get userId() {
            return userId
        },
        current,
    }
    if (!synthetic && !getAuthToken()) {
        fence.ready = authReady().then(
            () => {
                if (current()) userId = tokenUserId(getAuthToken())
            },
            () => {
                if (current()) unavailable?.()
                failed = true
            }
        )
    }
    return fence
}
