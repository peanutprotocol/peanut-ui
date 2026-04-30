/**
 * Rain Card API Service
 *
 * Client-side service for every Rain card endpoint (overview, apply,
 * activate/lock/cancel, reveal, PIN, limits, physical waitlist,
 * withdrawals, session-key grant). Uses the browser's JWT cookie directly
 * (via `js-cookie`) — matches the pattern in `services/manteca.ts` /
 * `services/simplefi.ts`.
 */

import Cookies from 'js-cookie'
import { PEANUT_API_KEY, PEANUT_API_URL } from '@/constants/general.consts'
import { fetchWithSentry } from '@/utils/sentry.utils'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RainCardApplicationStatus {
    hasApplication: boolean
    railStatus?: string
    applicationStatus?: string
    rainUserId?: string
    /** Collateral proxy address. */
    contractAddress?: string
    /** Rain Coordinator contract — target of `withdrawAsset`. */
    coordinatorAddress?: string
}

export interface RainCardBalance {
    creditLimit: number
    spendingPower: number
    pendingCharges: number
    postedCharges: number
    balanceDue: number
}

export interface RainCardSummary {
    id: string
    rainCardId: string
    last4: string
    expiryMonth: number
    expiryYear: number
    status: string
    network: string
    issuedAt: string
    /** Whether the user has granted the one-time session-key permission
     *  used to submit collateral withdrawals with a single passkey tap. */
    hasWithdrawApproval: boolean
}

export interface RainCardOverview {
    status: RainCardApplicationStatus
    balance: RainCardBalance | null
    cards: RainCardSummary[]
}

/**
 * Mirrors the backend `TransactionIntentKind` (legacy wire vocabulary).
 * Drives history categorization for collateral webhooks.
 */
export type TransactionIntentKind =
    | 'P2P_SEND'
    | 'QR_PAY'
    | 'LINK_CREATE'
    | 'CRYPTO_WITHDRAW'
    | 'FIAT_OFFRAMP'
    | 'FIAT_ONRAMP'
    | 'REQUEST_PAY'
    | 'AUTO_REBALANCE'
    | 'CARD_SPEND'
    | 'DEPOSIT_EXTERNAL'
    | 'OTHER'

export interface PrepareRainWithdrawalInput {
    amount: string // native units as decimal string (USDC cents: e.g. "500000" for $5.00 at 6dp)
    recipientAddress: string
    directTransfer: boolean
    /** User-semantic kind — drives history categorization for the collateral webhook. */
    kind: TransactionIntentKind
    /** Total user-initiated spend in cents. For mixed strategy this differs from
     *  `amount` (which is only the collateral shortfall). History shows this. */
    totalAmountCents?: string
}

export interface PrepareRainWithdrawalResponse {
    /** Short-lived intent id. Must be echoed back to `/submit`. */
    preparationId: string
    coordinatorAddress: string
    collateralProxy: string
    adminAddress: string
    chainId: string
    tokenAddress: string
    amount: string
    recipientAddress: string
    directTransfer: boolean
    adminSalt: string
    adminNonce: string
    executorSignature: string
    executorSalt: string
    expiresAt: number
}

export interface SubmitRainWithdrawalInput {
    preparationId: string
    amount: string
    recipientAddress: string
    directTransfer: boolean
    adminSalt: string
    adminNonce: string
    adminSignature: string
    executorSignature: string
    executorSalt: string
    expiresAt: number
}

export interface SubmitRainWithdrawalResponse {
    txHash: string
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
 * - `incomplete`: card-application action is missing data; returned token
 *   opens the card-application Applicant Action.
 * - `main-kyc-required`: main applicant is missing a doc Rain requires
 *   (e.g. SELFIE after liveness was added to the level). Token opens the
 *   WebSDK at the MAIN level so the user supplies just the missing step.
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
          status: 'main-kyc-required'
          missingDocTypes: string[]
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
        return rainRequest<RainCardOverview>({ method: 'GET', path: '/rain/cards' })
    },

    /**
     * Shared session-key address the frontend needs to scope the permission
     * grant to. Backend holds the private key; frontend only needs the
     * address.
     */
    getSessionKeyAddress: async (): Promise<{ address: string }> => {
        return rainRequest<{ address: string }>({ method: 'GET', path: '/rain/cards/session-key-address' })
    },

    /**
     * Persist the serialized ZeroDev permission on the user's card so the
     * backend can submit session-key UserOps for collateral withdrawals.
     */
    submitWithdrawSessionApproval: async (input: { serializedApproval: string }): Promise<void> => {
        await rainRequest<{ ok: boolean }>({
            method: 'POST',
            path: '/rain/cards/withdraw/session-approve',
            body: input,
        })
    },

    /**
     * Stage a Rain V2 withdrawal: backend fetches Rain's executor signature,
     * reads the current adminNonce from the collateral proxy, and persists a
     * short-lived prep record. Caller then signs the admin EIP-712 payload.
     */
    prepareWithdrawal: async (input: PrepareRainWithdrawalInput): Promise<PrepareRainWithdrawalResponse> => {
        return rainRequest<PrepareRainWithdrawalResponse>({
            method: 'POST',
            path: '/rain/cards/withdraw/prepare',
            body: input,
        })
    },

    /**
     * Submit a prepared withdrawal with the user's admin signature. Backend
     * verifies via ERC-1271 against the user's kernel and broadcasts the
     * coordinator call through the shared admin relayer.
     */
    submitWithdrawal: async (input: SubmitRainWithdrawalInput): Promise<SubmitRainWithdrawalResponse> => {
        return rainRequest<SubmitRainWithdrawalResponse>({
            method: 'POST',
            path: '/rain/cards/withdraw/submit',
            body: input,
        })
    },

    /**
     * Stamp a client-submitted mixed-strategy UserOp with its on-chain tx
     * hash so the Rain collateral webhook can reconcile against the right
     * intent. Non-fatal on failure.
     */
    stampWithdrawal: async (input: { preparationId: string; txHash: string }): Promise<void> => {
        try {
            await rainRequest<{ ok: boolean }>({
                method: 'POST',
                path: '/rain/cards/withdraw/stamp',
                body: input,
            })
        } catch (e) {
            // Non-fatal: intent stays PENDING until expiry, no history
            // categorization until then. Log loudly but don't block the user.
            console.warn('[rainApi.stampWithdrawal] failed:', (e as Error).message)
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
    applyForCard: async (
        opts: { termsAccepted?: boolean; serializedApproval?: string } = {}
    ): Promise<ApplyForCardResponse> => {
        // `serializedApproval` is consumed only by the re-issue branch on the
        // backend (where a RainCard row is created synchronously). First-time
        // applicants don't have a collateral proxy yet, so the frontend omits
        // the field entirely in that case.
        const body: Record<string, unknown> = { termsAccepted: opts.termsAccepted === true }
        if (opts.serializedApproval) body.serializedApproval = opts.serializedApproval
        return rainRequest<ApplyForCardResponse>({
            method: 'POST',
            path: '/rain/cards',
            body,
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
