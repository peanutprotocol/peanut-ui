/**
 * Rain Card API Service
 *
 * Client-side service for every Rain card endpoint (overview, apply,
 * activate/lock/cancel, reveal, PIN, limits, physical waitlist,
 * withdrawals, session-key grant). Uses the browser's JWT cookie directly
 * (via `js-cookie`) — matches the pattern in `services/manteca.ts`.
 */

import Cookies from 'js-cookie'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { PEANUT_API_KEY, PEANUT_API_URL } from '@/constants/general.consts'
import { fetchWithSentry } from '@/utils/sentry.utils'
import type { SignedRainWithdrawal } from '@/hooks/wallet/useSignSpendBundle'

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
    /**
     * Card collateral top-up funds debited from the smart account on-chain but
     * not yet credited to Rain collateral (the ~10–45s smart→collateral
     * handoff). Folded into the displayed balance so it doesn't crater to 0
     * mid-top-up. Optional for backward-compat with a pre-deploy backend.
     */
    inTransitToCollateralCents?: number
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
 * Outbound spend-intent vocabulary. Mirrors the kind values accepted by
 * the backend's withdraw / auto-balancer endpoints — translated to the
 * Prisma `TransactionIntentKind` enum at the API boundary. Named distinctly
 * from the history renderer's `IntentKind` union in strategies/registry.ts
 * (the inbound wire shape) to prevent silent drift between the two.
 */
export type RainCollateralKind =
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
    /** Rain cents (2dp), as a decimal string. e.g. `"500"` for $5.00.
     *  Convert from USDC wei via `usdcUnitsToRainCents` at the boundary. */
    amount: string
    recipientAddress: string
    directTransfer: boolean
    /** User-semantic kind — drives history categorization for the collateral webhook. */
    kind: RainCollateralKind
    /** Total user-initiated spend in cents. For mixed strategy this differs from
     *  `amount` (which is only the collateral shortfall). History shows this. */
    totalAmountCents?: string
    /** When this withdrawal pays a Peanut request/charge, the charge uuid.
     *  The backend then uses the charge intent itself as the prep and marks it
     *  COMPLETED on confirm — so the FE must NOT also call `recordPayment`. */
    chargeId?: string
}

export interface PrepareRainWithdrawalResponse {
    /** Short-lived intent id. Must be echoed back to `/submit`. */
    preparationId: string
    coordinatorAddress: string
    collateralProxy: string
    adminAddress: string
    chainId: string
    tokenAddress: string
    /** USDC wei (PEANUT_WALLET_TOKEN_DECIMALS, typically 6dp) — NOT cents.
     *  Rain accepts cents on input but echoes the on-chain wire value here:
     *  it's what the EIP-712 message and `coordinator.withdrawAsset` sign
     *  over, and what /submit broadcasts unchanged. Don't re-convert. */
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

// ─── Funds-recovery types ────────────────────────────────────────────────────
//
// Recovery is for the deleted-Rain-user case: Rain's balance endpoint stops
// returning the collateral, but the on-chain USDC is still there and Rain's
// signature endpoint still works. The server determines amount + recipient;
// the FE just signs the admin EIP-712 over what the server gives it. See
// peanut-api-ts/src/routes/rain/recover-funds.ts for the contract.

export interface RecoverFundsPreviewResponse {
    collateralProxy: string
    /** The user's own smart-wallet address — the only allowed recipient. */
    recipient: string
    /** Full on-chain USDC balance in token smallest units (6 dp). */
    amountWei: string
    /** Recoverable amount in Rain cents (2 dp). */
    amountCents: string
    /** Wei below one cent — stays in the contract after recovery. */
    dustWei: string
    autoBalanceEnabled: boolean
    hasRecoverableCard: boolean
}

export interface PrepareRecoverFundsResponse extends PrepareRainWithdrawalResponse {
    amountCents: string
    dustWei: string
}

// ─── Types for card management endpoints ────────────────────────────────────

export interface RainCardDetailsResponse {
    pan: string
    cvv: string
    expiryMonth: number
    expiryYear: number
    last4: string
    network: string
    /** Registered cardholder name from Rain. Best-effort on the backend, so it
     *  may be absent if the Rain user lookup failed. */
    cardholderName?: string
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
 * Thrown on 425 from `/rain/cards/withdraw/prepare`. Rain enforces a per-user
 * lock on withdrawal signatures: one active sig per user at a time, 5min
 * expiry + ~2min cooldown afterwards. Backend forwards Rain's `retryAfterSec`
 * when it can extract it from the upstream message; absent that, this is
 * thrown with `retryAfterSec === null` and the caller surfaces an inline
 * error string only (no cooldown UI), since we'd be making the number up.
 *
 * Side-effect-free: the global cooldown UI is engaged by `rainRequest` when
 * it constructs this error, NOT by the constructor itself — so logging,
 * Sentry serialization, and tests can build instances without popping UI.
 */
export class RainCooldownError extends Error {
    readonly retryAfterSec: number | null
    constructor(message: string, retryAfterSec: number | null) {
        super(message)
        this.name = 'RainCooldownError'
        this.retryAfterSec = retryAfterSec
    }
}

export interface RainCooldownEventDetail {
    retryAfterSec: number
    message: string
}

/** Path that legitimately produces the cooldown 425. Any other 425 from a
 *  Rain endpoint is treated as a generic upstream error — without this gate,
 *  an unrelated 425 (e.g. proxy "Too Early") would pop the cooldown modal on
 *  a totally unrelated screen. */
const RAIN_COOLDOWN_PATH = '/rain/cards/withdraw/prepare'

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
          // Sumsub address country contradicts the ID-document country (or is
          // junk). Show the residence-confirmation screen; re-call with
          // `confirmedResidenceCountry` set to one of `candidates`. Empty
          // `candidates` = neither signal usable → route to support.
          status: 'country-confirmation-required'
          candidates: string[]
          evidence: {
              addressCountry: string | null
              idDocumentCountry: string | null
          }
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
    /** Override fetchWithSentry's default 10s timeout (e.g. UserOp submissions). */
    timeoutMs?: number
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

    const response = await fetchWithSentry(
        `${PEANUT_API_URL}${opts.path}`,
        {
            method: opts.method,
            headers,
            body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
            cache: 'no-store',
        },
        opts.timeoutMs
    )

    if (response.status === 429 && opts.rateLimitSensitive) {
        const err = await response.json().catch(() => ({}))
        throw new RainCardRateLimitError(err.error || err.message || 'Too many requests')
    }

    if (response.status === 425 && opts.path === RAIN_COOLDOWN_PATH) {
        const err = await response.json().catch(() => ({}))
        // Only engage the cooldown UI when the backend gave us a real
        // retryAfterSec. Absent that we surface the error inline but don't
        // invent a countdown the upstream didn't authorize.
        const retryAfterSec =
            typeof err.retryAfterSec === 'number' && Number.isFinite(err.retryAfterSec) && err.retryAfterSec > 0
                ? err.retryAfterSec
                : null
        const message =
            err.error || err.message || 'A previous withdrawal is still active for this card. Try again shortly.'
        if (typeof window !== 'undefined') {
            // Captured here — the single point every spend path's cooldown 425
            // flows through — so all flows get telemetry, including the
            // retryAfterSec-less shape that shows no cooldown UI at all
            // (the PEANUT-UI-QJ1 blind spot). Flow context comes from
            // PostHog's auto-captured $pathname.
            posthog.capture(ANALYTICS_EVENTS.RAIN_COOLDOWN_HIT, { retry_after_sec: retryAfterSec })
            if (retryAfterSec !== null) {
                window.dispatchEvent(
                    new CustomEvent<RainCooldownEventDetail>('rain:cooldown', {
                        detail: { retryAfterSec, message },
                    })
                )
            }
        }
        throw new RainCooldownError(message, retryAfterSec)
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
     *
     * `/submit` is SYNCHRONOUS: it broadcasts AND awaits on-chain confirmation
     * (`waitForUserOperationReceipt` + `confirmIntentByTxHash`) before
     * responding, and for a request/charge it settles the charge in the same
     * call. That round-trip routinely exceeds the default 10s fetch budget, so
     * pass 120s — the same budget the verified-withdrawal path already uses for
     * this exact reason (see line ~525). With the 10s default the FE aborts
     * while the tx still lands + the charge settles: the user sees an error on a
     * payment that actually succeeded, retries, and double-sends. (#2245 routed
     * request payments through this path for the first time → the regression.)
     */
    submitWithdrawal: async (input: SubmitRainWithdrawalInput): Promise<SubmitRainWithdrawalResponse> => {
        return rainRequest<SubmitRainWithdrawalResponse>({
            method: 'POST',
            path: '/rain/cards/withdraw/submit',
            body: input,
            timeoutMs: 120_000,
        })
    },

    /**
     * Read-only preview of what would be recovered: on-chain USDC balance,
     * the user's smart-wallet recipient, and the current autoBalanceEnabled
     * flag. Backed by GET /rain/cards/recover-funds/preview — no side
     * effects, so safe to call on page mount and on refresh.
     */
    getRecoverFundsPreview: async (): Promise<RecoverFundsPreviewResponse> => {
        return rainRequest<RecoverFundsPreviewResponse>({
            method: 'GET',
            path: '/rain/cards/recover-funds/preview',
            noStore: true,
        })
    },

    /**
     * Side-effectful: flips autoBalanceEnabled to false, reads on-chain
     * balance, fetches Rain's executor signature for the FULL cent-aligned
     * amount payable to the user's smart wallet, creates a TransactionIntent.
     * Returns the prepared payload the caller signs with their kernel and
     * submits to /rain/cards/withdraw/submit (unchanged).
     *
     * Empty body on purpose — amount and recipient are server-locked.
     */
    prepareRecoverFunds: async (): Promise<PrepareRecoverFundsResponse> => {
        return rainRequest<PrepareRecoverFundsResponse>({
            method: 'POST',
            path: '/rain/cards/recover-funds/prepare',
            body: {},
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
     *  - `country-confirmation-required` → conflicting residence evidence;
     *    show the confirmation screen and re-call with
     *    `confirmedResidenceCountry` set to the user's pick.
     *  - `pending` / `ENABLED` / other → application submitted or already
     *    in-flight. Frontend should refetch overview and let the state
     *    machine route.
     */
    applyForCard: async (
        opts: { termsAccepted?: boolean; serializedApproval?: string; confirmedResidenceCountry?: string } = {}
    ): Promise<ApplyForCardResponse> => {
        // `serializedApproval` is consumed only by the re-issue branch on the
        // backend (where a RainCard row is created synchronously). First-time
        // applicants don't have a collateral proxy yet, so the frontend omits
        // the field entirely in that case.
        const body: Record<string, unknown> = { termsAccepted: opts.termsAccepted === true }
        if (opts.serializedApproval) body.serializedApproval = opts.serializedApproval
        if (opts.confirmedResidenceCountry) body.confirmedResidenceCountry = opts.confirmedResidenceCountry
        return rainRequest<ApplyForCardResponse>({
            method: 'POST',
            path: '/rain/cards',
            body,
            // The first-time-application path runs 7 sequential Sumsub calls, a
            // deliberate 2.5s readiness sleep, the Rain createApplication call,
            // and an optional inline issueCard — routinely 7-13s. The default
            // 10s fetch timeout clips that tail, aborting client-side while the
            // backend completes (user sees a false failure on a card that was
            // actually submitted). Give this one call generous headroom.
            timeoutMs: 60_000,
        })
    },

    /**
     * Cheap polling endpoint for the post-Sumsub WebSDK-close window.
     *
     * `applyForCard` is a heavy call — each invocation does `moveToLevel` +
     * `getApplicant` + `getQuestionnaireAnswers` against Sumsub's API. Polling
     * it every second for 15s during the async-review race adds up to ~75
     * Sumsub round-trips per stuck user. This endpoint reads a single
     * webhook-stamped flag from our DB instead, so it's safe to poll at high
     * frequency without burning Sumsub rate budget.
     */
    getCardApplyReadiness: async (): Promise<{
        ready: boolean
        hasApplication: boolean
        readyAt?: string
    }> => {
        return rainRequest<{ ready: boolean; hasApplication: boolean; readyAt?: string }>({
            method: 'GET',
            path: '/rain/cards/readiness',
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

    /**
     * Lock an active card. When the user has positive spending power, the
     * caller MUST pass `verifiedWithdrawal` — the backend returns 400
     * otherwise. Funds are returned to the user's smart wallet before the
     * lock so they stay liquid. Returns the new Rain status.
     */
    lockCard: async (cardId: string, verifiedWithdrawal?: SignedRainWithdrawal): Promise<string> => {
        const { status } = await rainRequest<{ status: string }>({
            method: 'POST',
            path: `/rain/cards/${cardId}/lock`,
            body: verifiedWithdrawal ? { verifiedWithdrawal } : {},
            // Withdrawal path includes a UserOp wait — extend past the 10s default.
            timeoutMs: verifiedWithdrawal ? 120_000 : undefined,
        })
        return status
    },

    /**
     * Cancel a card. When the user has positive spending power, the caller
     * MUST pass `verifiedWithdrawal` — the backend returns 400 otherwise.
     * Funds are returned to the user's smart wallet before the cancel,
     * since cancel can be terminal on Rain's side.
     * Optional feedback persisted on RainCard.cancellationReason.
     */
    cancelCard: async (
        cardId: string,
        opts?: { feedback?: string; verifiedWithdrawal?: SignedRainWithdrawal }
    ): Promise<string> => {
        const body: Record<string, unknown> = {}
        if (opts?.feedback) body.feedback = opts.feedback
        if (opts?.verifiedWithdrawal) body.verifiedWithdrawal = opts.verifiedWithdrawal
        const { status } = await rainRequest<{ status: string }>({
            method: 'POST',
            path: `/rain/cards/${cardId}/cancel`,
            // Always send an object — Fastify's schema validator rejects a
            // missing body against `Type.Optional(Type.Object(...))` when the
            // request has no Content-Type, producing "body must be object".
            body,
            // Withdrawal path includes a UserOp wait — extend past the 10s default.
            timeoutMs: opts?.verifiedWithdrawal ? 120_000 : undefined,
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
