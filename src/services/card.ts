/**
 * Card API service — virtual-card waitlist + flow access.
 *
 * Client-side fetches to /card and /card/waitlist/* via apiFetch, so auth
 * works on both web and native. Native builds hold the JWT in Preferences and
 * send it as an Authorization header — the cookie jar is empty there, so the
 * old cookie-only header threw `Authentication required` on native, blanking
 * hasCardAccess and dropping the card nav onto /shhhhh.
 *
 * Pioneer purchase API (`purchase()`) was removed in Phase 4 of the M2
 * launch — the new free badge-gated waitlist supersedes it.
 */

import { PEANUT_API_KEY } from '@/constants/general.consts'
import { apiFetch } from '@/utils/api-fetch'

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
    /** True once the card flow is public for EVERYONE (now >= CARD_PUBLIC_LAUNCH_DATE).
     *  Unlike `flowEarlyAccess`, this is NOT true pre-launch for /shhhhh-stamped or
     *  badge-holding users — it flips for all users at the same instant. Drives the
     *  home launch CTA. */
    isPublicLaunched: boolean
    waitlistJoinedAt: string | null
    waitlistPosition: number | null
    waitlistReleasedAt: string | null
    /** Skip-badge codes the user holds (subset of SKIP_BADGE_CODES on BE). */
    skipBadges: string[]
    /** Global door-tally counts (same for every user) — power the Berghain
     *  rejection screen. `waitlistTotal` = total who joined the waitlist (the FE
     *  inflates it for the FOMO "tried"); `admittedTotal` = total released/granted
     *  (shown verbatim as "got in").
     *
     *  OPTIONAL on purpose: the BE that returns these (peanut-api-ts) deploys
     *  first, but during the rollout window — and for any older API — the FE
     *  must tolerate `undefined`. `computeDoorTally` falls back to 213 / 7. */
    waitlistTotal?: number
    admittedTotal?: number
}

export interface WaitlistStateResponse {
    joinedAt: string | null
    position: number | null
    releasedAt: string | null
}

const cardHeaders = { 'api-key': PEANUT_API_KEY }

export const cardApi = {
    /** GET /card — info + waitlist state. */
    getInfo: async (): Promise<CardInfoResponse> => {
        const response = await apiFetch('/card', {
            method: 'GET',
            headers: cardHeaders,
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
        const response = await apiFetch('/card/waitlist/join', {
            method: 'POST',
            headers: cardHeaders,
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
        const response = await apiFetch('/card/waitlist/state', {
            method: 'GET',
            headers: cardHeaders,
            cache: 'no-store',
        })
        if (!response.ok) {
            const err = await response.json().catch(() => ({}))
            throw new Error(err.message || err.error || 'Failed to get waitlist state')
        }
        return (await response.json()) as WaitlistStateResponse
    },
}
