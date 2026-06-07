/**
 * Card API service — virtual-card waitlist + flow access.
 *
 * Client-side fetches to /card and /card/waitlist/*. Matches the pattern in
 * services/rain.ts and services/manteca.ts: JWT from cookie, no Next.js
 * server-action indirection.
 *
 * Pioneer purchase API (`purchase()`) was removed in Phase 4 of the M2
 * launch — the new free badge-gated waitlist supersedes it.
 */

import Cookies from 'js-cookie'
import { PEANUT_API_KEY, PEANUT_API_URL } from '@/constants/general.consts'
import { fetchWithSentry } from '@/utils/sentry.utils'

export interface CardInfoResponse {
    /** Inner gate: cardAccessGrantedAt set OR holds a SKIP_BADGE_CODES badge
     *  (which includes the grandfathered CARD_PIONEER). */
    hasCardAccess: boolean
    /** Rain card geography eligibility — true iff user's country is in the
     *  Rain card geo list. Not affected by waitlist state. */
    isEligible: boolean
    eligibilityReason?: string
    // ─── Waitlist fields (Card Waitlist Launch — M2 2026-06-01) ──
    /** Outer gate. True iff user can ENTER the /card flow (via /shhhhh
     *  early access or post-public-launch). */
    flowEarlyAccess: boolean
    waitlistJoinedAt: string | null
    waitlistPosition: number | null
    waitlistReleasedAt: string | null
    /** Skip-badge codes the user holds (subset of SKIP_BADGE_CODES on BE). */
    skipBadges: string[]
    /** ISO timestamp once the user acknowledged the skip-the-line celebration;
     *  null = not yet. Drives retirement of the "You skipped the line" history row. */
    cardWaitlistSkipCelebrationSeenAt: string | null
}

export interface WaitlistStateResponse {
    joinedAt: string | null
    position: number | null
    releasedAt: string | null
}

function authHeaders(): Record<string, string> {
    const jwt = Cookies.get('jwt-token')
    if (!jwt) throw new Error('Authentication required')
    return {
        Authorization: `Bearer ${jwt}`,
        'api-key': PEANUT_API_KEY,
    }
}

export const cardApi = {
    /** GET /card — info + waitlist state. */
    getInfo: async (): Promise<CardInfoResponse> => {
        const response = await fetchWithSentry(`${PEANUT_API_URL}/card`, {
            method: 'GET',
            headers: authHeaders(),
            cache: 'no-store',
        })
        if (!response.ok) {
            const err = await response.json().catch(() => ({}))
            throw new Error(err.message || err.error || 'Failed to get card info')
        }
        return (await response.json()) as CardInfoResponse
    },

    /** POST /card/waitlist/join — idempotent stamp + position. */
    joinWaitlist: async (): Promise<{ joinedAt: string; position: number | null }> => {
        const response = await fetchWithSentry(`${PEANUT_API_URL}/card/waitlist/join`, {
            method: 'POST',
            headers: { ...authHeaders(), 'Content-Type': 'application/json' },
            body: '{}',
            cache: 'no-store',
        })
        if (!response.ok) {
            const err = await response.json().catch(() => ({}))
            throw new Error(err.message || err.error || 'Failed to join waitlist')
        }
        return (await response.json()) as { joinedAt: string; position: number | null }
    },

    /** GET /card/waitlist/state — current waitlist state. */
    getWaitlistState: async (): Promise<WaitlistStateResponse> => {
        const response = await fetchWithSentry(`${PEANUT_API_URL}/card/waitlist/state`, {
            method: 'GET',
            headers: authHeaders(),
            cache: 'no-store',
        })
        if (!response.ok) {
            const err = await response.json().catch(() => ({}))
            throw new Error(err.message || err.error || 'Failed to get waitlist state')
        }
        return (await response.json()) as WaitlistStateResponse
    },

    /** POST /card/flow-early-access — stamps cardFlowEarlyAccessAt. Called
     *  by /shhhhh "Try the door" CTA before routing the user to /card. */
    grantFlowEarlyAccess: async (): Promise<{ grantedAt: string }> => {
        const response = await fetchWithSentry(`${PEANUT_API_URL}/card/flow-early-access`, {
            method: 'POST',
            headers: { ...authHeaders(), 'Content-Type': 'application/json' },
            body: '{}',
            cache: 'no-store',
        })
        if (!response.ok) {
            const err = await response.json().catch(() => ({}))
            throw new Error(err.message || err.error || 'Failed to grant early access')
        }
        return (await response.json()) as { grantedAt: string }
    },

    /** POST /card/celebration-seen — idempotently stamps
     *  cardWaitlistSkipCelebrationSeenAt so the "You skipped the line" history
     *  row retires. Best-effort; callers ignore failures. */
    markCelebrationSeen: async (): Promise<{ seenAt: string }> => {
        const response = await fetchWithSentry(`${PEANUT_API_URL}/card/celebration-seen`, {
            method: 'POST',
            headers: { ...authHeaders(), 'Content-Type': 'application/json' },
            body: '{}',
            cache: 'no-store',
        })
        if (!response.ok) {
            const err = await response.json().catch(() => ({}))
            throw new Error(err.message || err.error || 'Failed to mark celebration seen')
        }
        return (await response.json()) as { seenAt: string }
    },
}
