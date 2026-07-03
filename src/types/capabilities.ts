/**
 * Capability contract — the single shape the frontend consumes to answer
 * "what can this user do, and what's needed to unlock more?". Computed
 * backend-side by the resolver and embedded in /get-user (at the TOP LEVEL of
 * the response, sibling of `user`) and served standalone by GET /users/capabilities.
 * The FE reads this and nothing else; no provider-state interpretation lives on
 * the client.
 *
 * INTERIM: these interfaces are hand-mirrored from the peanut-api-ts contract
 * (`src/kyc/capabilities/types.ts`). They will be REPLACED by the generated
 * OpenAPI type (`pnpm gen:api` → `src/types/api.generated.ts`) once the API PR's
 * OpenAPI snapshot lands. Until then, this file is the source of truth FE-side.
 * Keep it byte-for-byte aligned with the backend contract.
 *
 * See engineering/projects/kyc-2.0/capabilities-rehaul-plan.md.
 */

export type ProviderCode = 'bridge' | 'manteca' | 'rain'

/** Capability status of a single rail, provider-neutral. */
export type RailCapabilityStatus =
    | 'enabled' // user can use this rail now
    | 'pending' // provisioning/submitted, no user action needed — poll
    | 'requires-info' // user must complete a nextAction to unlock
    | 'blocked' // cannot be unlocked (restriction / final rejection)

/**
 * What a user can DO on a rail. A single rail can support a payment to a
 * merchant (`pay`, e.g. a QR code) distinctly from first-party bank movements
 * (`deposit` / `withdraw`) — and these can have different statuses on the SAME
 * rail. Today only Manteca diverges: a Sumsub-approved user pays QR via a pool
 * account, but deposit/withdraw need their own full Manteca account, and BR
 * `pix_br` is both the pay channel and the withdraw channel.
 */
export type RailOperation = 'pay' | 'deposit' | 'withdraw'

/** Stable rail identifier: `${provider}.${methodCode-lowercased}` e.g. 'bridge.ach_us'. */
export type RailId = `${ProviderCode}.${string}`

export interface CapabilityReason {
    code: string // normalized: 'proof_of_address' | 'manteca_us_nationality' | 'document_rejected' | …
    userMessage: string // friendly, display-ready
    /**
     * Optional technical detail captured from a provider response or a
     * pipeline-side failure (REQUIRES_SUPPORT). Not user-facing copy — the FE
     * forwards it to the Crisp pre-fill so the support agent sees what broke.
     */
    details?: string
}

/**
 * User-facing categorization of how a rail moves money — what the customer
 * SEES, not which provider serves it.
 *   - `bank`     bank account on either end (ACH, SEPA, SPEI, PIX, AR bank-transfer, faster-payments)
 *   - `card`     spending via a Peanut card (Rain's product)
 *   - `qr-only`  QR scan with no first-party bank account involvement (MercadoPago wallet)
 *
 * Computed BE-side from `method` — the FE never has to enumerate which
 * methods are bank/card/qr.
 */
export type RailChannel = 'bank' | 'card' | 'qr-only'

export interface RailCapability {
    id: RailId
    provider: ProviderCode
    method: string // 'ACH_US'
    /** User-facing channel: bank / card / qr-only. Derived BE-side from `method`. */
    channel: RailChannel
    country: string // jurisdiction, not strict ISO-2: 'US' | 'EU' | 'GLOBAL' | …
    currency: string
    status: RailCapabilityStatus
    /**
     * Per-operation refinement of `status`. ABSENT → `status` applies to every
     * operation (Bridge, Rain — no pay/withdraw split). PRESENT → read the
     * specific op, falling back to `status`: `operations?.[op] ?? status`.
     * Only operations the method actually supports are listed.
     */
    operations?: Partial<Record<RailOperation, RailCapabilityStatus>>
    /** keys into NextAction.key — actions that unlock currently-unavailable operations on this rail. */
    blockingActions?: string[]
    /**
     * Non-blocking hints — actions the user CAN take on a rail that's otherwise
     * working (the rail stays usable): the Bridge advisory pre-empt (a future-dated
     * requirement whose NextAction carries `effectiveDate`) and the Manteca
     * cap-nudge. Distinct from `blockingActions` so the FE never gates on them.
     */
    hintActions?: string[]
    /** present for requires-info / blocked — normalized reason for uniform FE rendering. */
    reason?: CapabilityReason
}

/**
 * Action kinds the FE dispatches on:
 *   - `sumsub`            — mint a token for an RFI applicant action
 *   - `accept-tos`        — open Bridge's hosted ToS link
 *   - `wait`              — backend is processing; no user action needed
 *   - `contact-support`   — terminal blocker; open the support drawer
 *   - `restart-identity`  — reset the Sumsub IDENTITY step and re-open the
 *                           WebSDK so the user can verify with a different
 *                           document (used for the country-not-supported CTA
 *                           on Manteca-only rails; user has a self-fix path).
 */
export type NextActionKind = 'sumsub' | 'accept-tos' | 'wait' | 'contact-support' | 'restart-identity' | 'provide-email'

export interface NextAction {
    key: string // stable id, referenced by RailCapability.blockingActions
    kind: NextActionKind
    purpose: string // 'unlock-bridge-sepa' | 'rain-card' | 'raise-manteca-limit' | …
    /** for kind:'sumsub' — registry key, NOT a literal level name. FE passes it back to start-action. */
    levelKey?: string
    /** for kind:'accept-tos' */
    tosUrl?: string
    /**
     * Advisory (non-blocking) actions only — surfaced via RailCapability.hintActions.
     * ISO date the requirement becomes blocking (Bridge future_requirements[].effective_date);
     * absent on current/blocking actions. The FE renders a skippable "complete before {date}" pre-empt.
     */
    effectiveDate?: string
    /** Advisory actions only — the provider requirement key, for telemetry / FE branching. */
    requirementKey?: string
}

export interface CapabilityRestriction {
    code: string // 'manteca_us_nationality' | …
    affectedRailIds: RailId[]
    userMessage: string
}

/** The block embedded in /get-user (top-level) and returned by GET /users/capabilities. */
export interface UserCapabilities {
    rails: RailCapability[]
    nextActions: NextAction[]
    restrictions: CapabilityRestriction[]
}

/**
 * Provider-agnostic identity-verification status — the second FE-facing
 * read-model (sibling to {@link UserCapabilities}), embedded top-level in
 * /get-user. The user does ONE identity check (documents); this is its status.
 * The FE NEVER learns a provider name — Bridge/Manteca approval lives in the
 * rail capability statuses, not here.
 */
export type IdentityVerificationStatus = 'not_started' | 'processing' | 'verified' | 'action_required' | 'failed'

export interface IdentityVerification {
    status: IdentityVerificationStatus
    /** present for action_required / failed — friendly, display-ready, provider-neutral. */
    actionMessage?: string
    /** normalized rejection labels for specific guidance (action_required / failed). */
    rejectLabels?: string[]
    /** ISO timestamp the user submitted their verification. */
    submittedAt?: string
    /** ISO timestamp the decision landed. */
    reviewedAt?: string
}
