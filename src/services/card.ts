import { authReady, getAuthToken } from '@/utils/auth-token'
import { apiFetch } from '@/utils/api-fetch'
import { isDemoMode } from '@/utils/demo'
import { isCapacitor } from '@/utils/capacitor'

/** Geography is checked again by the backend when the user applies. */
export interface CardInfoResponse {
    isEligible: boolean
    /** Known prohibited residence. Unknown country must still reach verification. */
    geoProhibited?: boolean
    eligibilityReason?: string
}

export class CardAuthenticationRequiredError extends Error {
    constructor() {
        super('Authentication required')
        this.name = 'CardAuthenticationRequiredError'
    }
}

/**
 * Fail fast — loud and local — instead of an opaque 401 from an
 * unauthenticated request. apiFetch itself awaits authReady() and attaches
 * the Bearer token; this only checks one exists. Web-only, same shape as
 * rain.ts: on Capacitor a legacy cookie-jar session holds no JS-readable
 * token (auth rides apiFetch's native transport), so reading the token here
 * would wrongly 401 native — the exact bug the header above documents.
 * Demo mode has no JWT — skip so the request reaches apiFetch's demo
 * interceptor (which serves /card). (The old api-key header was dead
 * weight: PEANUT_API_KEY has no NEXT_PUBLIC_ prefix so it is undefined in
 * the client bundle, and the backend dropped its api-key requirement — see
 * api-fetch.ts.)
 */
async function assertAuthenticated(): Promise<void> {
    if (isDemoMode() || isCapacitor()) return
    await authReady()
    if (!getAuthToken()) throw new CardAuthenticationRequiredError()
}

export const cardApi = {
    /** GET /card — residence eligibility. */
    getInfo: async (): Promise<CardInfoResponse> => {
        await assertAuthenticated()
        const response = await apiFetch('/card', {
            method: 'GET',
            cache: 'no-store',
        })
        if (!response.ok) {
            const err = await response.json().catch(() => ({}))
            throw new Error(err.message || err.error || 'Failed to get card info')
        }
        return (await response.json()) as CardInfoResponse
    },

    /**
     * POST /card/funding-pending — the user sent a bank transfer from the card's funding step. The API
     * keeps that for 7 days, so the push for the landing deposit opens the card step (TASK-25169). No
     * body: the session names the user.
     */
    markFundingPending: async (): Promise<void> => {
        await assertAuthenticated()
        const response = await apiFetch('/card/funding-pending', { method: 'POST' })
        // 404: the API that keeps the marker is not deployed yet (peanut-api-ts#2314 ships first). The
        // push then stays the plain receipt, which is no error worth reporting.
        if (response.status === 404) return
        if (!response.ok) throw new Error(`Failed to mark card funding pending: ${response.status}`)
    },
}
