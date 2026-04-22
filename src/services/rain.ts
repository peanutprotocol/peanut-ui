/**
 * Rain Card API Service
 *
 * Client-side service for Rain card management endpoints. Uses the browser's
 * JWT cookie directly (via `js-cookie`) rather than a Next.js server action —
 * matches the pattern in `services/manteca.ts` / `services/simplefi.ts`.
 *
 * The composite overview + withdrawal-prep / submit / stamp calls still go
 * through server actions in `app/actions/rain.ts` (pre-existing). New Rain
 * endpoints are added here.
 */

import Cookies from 'js-cookie'
import {
    getRainCardOverview,
    prepareRainWithdrawal,
    stampRainWithdrawal,
    submitRainWithdrawal,
} from '@/app/actions/rain'
import type {
    PrepareRainWithdrawalInput,
    PrepareRainWithdrawalResponse,
    RainCardApplicationStatus,
    RainCardBalance,
    RainCardOverview,
    RainCardSummary,
    SubmitRainWithdrawalInput,
    SubmitRainWithdrawalResponse,
    TransactionIntentKind,
} from '@/app/actions/rain'
import { PEANUT_API_KEY, PEANUT_API_URL } from '@/constants/general.consts'
import { fetchWithSentry } from '@/utils/sentry.utils'

export type {
    PrepareRainWithdrawalInput,
    PrepareRainWithdrawalResponse,
    RainCardApplicationStatus,
    RainCardBalance,
    RainCardOverview,
    RainCardSummary,
    SubmitRainWithdrawalInput,
    SubmitRainWithdrawalResponse,
    TransactionIntentKind,
}

// ─── Types for card management endpoints ────────────────────────────────────

export interface RainCardDetailsResponse {
    pan: string
    cvv: string
    expiryMonth: number
    expiryYear: number
    last4: string
    network: string
}

export type RainLimitFrequency = 'perAuthorization' | 'per24HourPeriod' | 'per30DayPeriod' | 'perAllTime'

export interface RainCardLimit {
    amount: number
    frequency: RainLimitFrequency
}

export interface PhysicalWaitlistState {
    joinedAt: string | null
    position: number | null
}

export class RainCardRateLimitError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'RainCardRateLimitError'
    }
}

/**
 * Response shapes for `POST /rain/cards` — apply for a Rain card.
 * - `incomplete`: user's Sumsub profile is missing data; returned token opens
 *   the card-application Applicant Action so the user can fill it in.
 * - `pending`: application submitted to Rain; wait for webhook to approve.
 * - any other string: existing application in that state (ENABLED / REJECTED / …).
 */
export type ApplyForCardResponse =
    | {
          status: 'incomplete'
          missing: string[]
          questionnaireComplete: boolean
          sumsubAccessToken: string
      }
    | {
          status: 'terms-required'
          isUsResident: boolean
          termsVersion: string
      }
    | {
          status: 'pending'
          rainUserId: string
          message: string
      }
    | {
          status: string
          rainUserId?: string
          message: string
      }

// ─── Internal request helper ────────────────────────────────────────────────

interface RequestOpts {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH'
    path: string
    body?: unknown
    /** If true, a 429 throws `RainCardRateLimitError` with the server's message. */
    rateLimitSensitive?: boolean
    /** Mirror PCI no-cache intent on the client fetch for secrets endpoints. */
    noStore?: boolean
}

async function rainRequest<T>(opts: RequestOpts): Promise<T> {
    const jwt = Cookies.get('jwt-token')
    if (!jwt) throw new Error('Authentication required')

    const headers: Record<string, string> = {
        Authorization: `Bearer ${jwt}`,
        'api-key': PEANUT_API_KEY,
    }
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
    if (opts.noStore) headers['Cache-Control'] = 'no-store'

    const response = await fetchWithSentry(`${PEANUT_API_URL}${opts.path}`, {
        method: opts.method,
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        cache: 'no-store',
    })

    if (response.status === 429 && opts.rateLimitSensitive) {
        const err = await response.json().catch(() => ({}))
        throw new RainCardRateLimitError(err.error || err.message || 'Too many requests')
    }

    if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || err.message || `Request failed: ${response.status}`)
    }

    return (await response.json()) as T
}

// ─── Public API ─────────────────────────────────────────────────────────────

export const rainApi = {
    /** Authoritative card-section state: status + balance + cards. */
    getOverview: async (): Promise<RainCardOverview> => {
        const result = await getRainCardOverview()
        if (result.error || !result.data) {
            throw new Error(result.error || 'Failed to load card overview')
        }
        return result.data
    },

    /** Stage a Rain withdrawal so the user can sign the admin EIP-712 payload. */
    prepareWithdrawal: async (input: PrepareRainWithdrawalInput): Promise<PrepareRainWithdrawalResponse> => {
        const result = await prepareRainWithdrawal(input)
        if (result.error || !result.data) {
            throw new Error(result.error || 'Failed to prepare withdrawal')
        }
        return result.data
    },

    /** Submit a prepared withdrawal with the user's admin signature. */
    submitWithdrawal: async (input: SubmitRainWithdrawalInput): Promise<SubmitRainWithdrawalResponse> => {
        const result = await submitRainWithdrawal(input)
        if (result.error || !result.data) {
            throw new Error(result.error || 'Failed to submit withdrawal')
        }
        return result.data
    },

    /** Stamp a client-submitted mixed-strategy UserOp with its on-chain tx hash. */
    stampWithdrawal: async (input: { preparationId: string; txHash: string }): Promise<void> => {
        const result = await stampRainWithdrawal(input)
        if (result.error) {
            // Non-fatal: intent stays PENDING until expiry, no history categorization
            // until then. Log loudly but don't block the user.
            console.warn('[rainApi.stampWithdrawal] failed:', result.error)
        }
    },

    /**
     * Apply for a Rain card. Response can be:
     *  - `incomplete` → user must complete the Sumsub card-application
     *    Applicant Action. The token to open it is included.
     *  - `terms-required` → backend is ready to submit but needs explicit
     *    consent; re-call with `termsAccepted: true` to proceed.
     *  - `pending` / `ENABLED` / other → application submitted or already
     *    in-flight. Frontend should refetch overview and let the state
     *    machine route.
     */
    applyForCard: async (opts: { termsAccepted?: boolean } = {}): Promise<ApplyForCardResponse> => {
        return rainRequest<ApplyForCardResponse>({
            method: 'POST',
            path: '/rain/cards',
            body: { termsAccepted: opts.termsAccepted === true },
        })
    },

    /** Activate a card (from locked or not-activated). Returns the new Rain status. */
    activateCard: async (cardId: string): Promise<string> => {
        const { status } = await rainRequest<{ status: string }>({
            method: 'POST',
            path: `/rain/cards/${cardId}/activate`,
        })
        return status
    },

    /** Lock an active card. Returns the new Rain status. */
    lockCard: async (cardId: string): Promise<string> => {
        const { status } = await rainRequest<{ status: string }>({
            method: 'POST',
            path: `/rain/cards/${cardId}/lock`,
        })
        return status
    },

    /** Cancel a card. Optional feedback persisted on RainCard.cancellationReason. */
    cancelCard: async (cardId: string, feedback?: string): Promise<string> => {
        const { status } = await rainRequest<{ status: string }>({
            method: 'POST',
            path: `/rain/cards/${cardId}/cancel`,
            // Always send an object — Fastify's schema validator rejects a
            // missing body against `Type.Optional(Type.Object(...))` when the
            // request has no Content-Type, producing "body must be object".
            body: feedback ? { feedback } : {},
        })
        return status
    },

    /** Attach feedback to an already-canceled card. Non-fatal on failure. */
    submitCancellationFeedback: async (cardId: string, feedback: string): Promise<void> => {
        await rainRequest<{ ok: boolean }>({
            method: 'POST',
            path: `/rain/cards/${cardId}/cancellation-feedback`,
            body: { feedback },
        })
    },

    /** Reveal a card's PAN/CVV/expiry. Throws RainCardRateLimitError on 429. */
    getCardDetails: async (cardId: string): Promise<RainCardDetailsResponse> => {
        return rainRequest<RainCardDetailsResponse>({
            method: 'GET',
            path: `/rain/cards/${cardId}/details`,
            rateLimitSensitive: true,
            noStore: true,
        })
    },

    /** Read the current spending limits (per-txn / 24h / 30d / all-time) from Rain. */
    getCardLimits: async (cardId: string): Promise<RainCardLimit[]> => {
        const { limits } = await rainRequest<{ limits: RainCardLimit[] }>({
            method: 'GET',
            path: `/rain/cards/${cardId}/limits`,
        })
        return limits
    },

    /** Update one or more spending limits. Sends one PATCH per frequency on the backend. */
    updateCardLimits: async (cardId: string, limits: RainCardLimit[]): Promise<void> => {
        await rainRequest<{ ok: boolean }>({
            method: 'PATCH',
            path: `/rain/cards/${cardId}`,
            body: { limits },
        })
    },

    /**
     * Reveal the PIN for a card. Returns `null` when the card has no PIN set
     * yet (fresh cards are issued without a PIN — user has to set one).
     * Throws RainCardRateLimitError on 429.
     */
    getCardPin: async (cardId: string): Promise<string | null> => {
        const { pin } = await rainRequest<{ pin: string | null }>({
            method: 'GET',
            path: `/rain/cards/${cardId}/pin`,
            rateLimitSensitive: true,
            noStore: true,
        })
        return pin
    },

    /** Set or change a card's PIN. */
    setCardPin: async (cardId: string, pin: string): Promise<void> => {
        await rainRequest<{ ok: boolean }>({
            method: 'PUT',
            path: `/rain/cards/${cardId}/pin`,
            body: { pin },
            noStore: true,
        })
    },

    /** Get the physical-card waitlist state for this card. */
    getPhysicalWaitlist: async (cardId: string): Promise<PhysicalWaitlistState> => {
        return rainRequest<PhysicalWaitlistState>({
            method: 'GET',
            path: `/rain/cards/${cardId}/physical-waitlist`,
        })
    },

    /** Join the physical-card waitlist (idempotent). */
    joinPhysicalWaitlist: async (cardId: string): Promise<{ joinedAt: string; position: number }> => {
        return rainRequest<{ joinedAt: string; position: number }>({
            method: 'POST',
            path: `/rain/cards/${cardId}/physical-waitlist`,
        })
    },
}
