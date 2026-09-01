/**
 * KYC capability profiles — the fixture dimension for the matrix tier.
 *
 * One profile answers "this user, from this country, having submitted these
 * documents, got this answer back from the providers". It carries nothing but
 * the two read-models the FE is allowed to interpret — `capabilities` and
 * `identityVerification` — because those are the entire contract between the
 * backend's KYC routing and every screen the user sees afterwards
 * (see mono/projects/kyc-2.0/capabilities-rehaul-plan.md, D9).
 *
 * `documents` and `outcome` are DOCUMENTATION, not inputs: nothing in the FE
 * reads them. They record which real-world submission the hand-written
 * capability block is meant to represent, so a reviewer can check the fixture
 * against the provider branching matrix
 * (mono/projects/kyc-2.0/provider-branching-matrix.md) instead of guessing.
 */

import type { IdentityVerification, NextAction, RailCapability, UserCapabilities } from '@/types/capabilities'

/** ID documents / questionnaires the simulated applicant uploaded to Sumsub. */
export type SubmittedDocument =
    | 'passport'
    | 'national-id'
    | 'selfie'
    | 'proof-of-address'
    | 'tax-id'
    | 'source-of-funds'

export interface KycProfile {
    /** Stable id — also the test title and the screenshot label. */
    id: string
    /** One line a reviewer can check against the provider branching matrix. */
    summary: string
    /** ISO-2 country of residence the applicant declared. */
    country: string
    /** What the applicant actually submitted. Documentation only. */
    documents: SubmittedDocument[]
    /** What the providers answered. Documentation only. */
    outcome: string
    identityVerification: IdentityVerification
    capabilities: UserCapabilities
}

const VERIFIED_AT = '2026-01-01T00:00:00.000Z'

const verified: IdentityVerification = {
    status: 'verified',
    submittedAt: VERIFIED_AT,
    reviewedAt: VERIFIED_AT,
}

/**
 * Rail builder. `id` is derived rather than passed so a fixture can never
 * declare `bridge.ach_us` while carrying `provider: 'manteca'` — a mismatch
 * the resolver would never emit but a hand-written fixture easily could.
 */
function rail(
    provider: RailCapability['provider'],
    method: string,
    fields: Omit<RailCapability, 'id' | 'provider' | 'method'>
): RailCapability {
    return { id: `${provider}.${method.toLowerCase()}` as RailCapability['id'], provider, method, ...fields }
}

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

/**
 * US resident, clean pass. Sumsub GREEN → submitToProviders → Bridge customer
 * active → ACH_US enabled. The reference happy path for a Bridge jurisdiction.
 */
const usBridgeApproved: KycProfile = {
    id: 'us-bridge-approved',
    summary: 'US resident, passport + selfie, Sumsub GREEN → Bridge ACH enabled',
    country: 'US',
    documents: ['passport', 'selfie'],
    outcome: 'sumsub GREEN → bridge customer active, base endorsement approved',
    identityVerification: verified,
    capabilities: {
        rails: [
            rail('bridge', 'ACH_US', {
                channel: 'bank',
                country: 'US',
                currency: 'USD',
                status: 'enabled',
            }),
        ],
        nextActions: [],
        restrictions: [],
    },
}

/**
 * EU resident who verified for SEPA and then walks into the US bank screen.
 * Identity IS verified, but no rail exists in the US jurisdiction — the
 * cross-region case. Guards the "Unlock {region}" no-op loop that
 * `crossRegionProvider` was introduced to fix.
 */
const euSepaApprovedTriesUs: KycProfile = {
    id: 'eu-sepa-approved',
    summary: 'DE resident, national ID + selfie, Sumsub GREEN → SEPA only (no US rail)',
    country: 'DE',
    documents: ['national-id', 'selfie'],
    outcome: 'sumsub GREEN → bridge customer active for EU rails only',
    identityVerification: verified,
    capabilities: {
        rails: [
            rail('bridge', 'SEPA_EU', {
                channel: 'bank',
                country: 'EU',
                currency: 'EUR',
                status: 'enabled',
            }),
        ],
        nextActions: [],
        restrictions: [],
    },
}

const POA_ACTION_KEY = 'provider-rfi-proof-of-address'

/**
 * US resident whose government ID was issued elsewhere. Per the provider
 * branching matrix (§1.1) Bridge demands a proof-of-address when the ID
 * country and the residence country disagree, which lands as a
 * `requires-info` rail carrying a self-serve Sumsub RFI action.
 */
const usBridgeNeedsProofOfAddress: KycProfile = {
    id: 'us-bridge-needs-poa',
    summary: 'US resident, foreign passport + selfie, no PoA → Bridge requires proof of address',
    country: 'US',
    documents: ['passport', 'selfie'],
    outcome: 'sumsub GREEN, bridge requires_information: proof_of_address (ID country ≠ residence)',
    identityVerification: verified,
    capabilities: {
        rails: [
            rail('bridge', 'ACH_US', {
                channel: 'bank',
                country: 'US',
                currency: 'USD',
                status: 'requires-info',
                blockingActions: [POA_ACTION_KEY],
                reason: {
                    code: 'proof_of_address',
                    userMessage: 'We need a recent proof of address — a utility bill or bank statement.',
                },
                resolved: {
                    status: 'fixable',
                    blocking: {
                        code: 'proof_of_address',
                        userMessage: 'We need a recent proof of address — a utility bill or bank statement.',
                        selfHealable: true,
                        selfHealKind: 'document-resubmit',
                    },
                },
            }),
        ],
        nextActions: [
            {
                key: POA_ACTION_KEY,
                kind: 'sumsub',
                purpose: 'unlock-bridge-ach',
                levelKey: 'bridge',
            } satisfies NextAction,
        ],
        restrictions: [],
    },
}

/**
 * AR resident on the Manteca QR pool tier. The rail is ENABLED for `pay`
 * (any Sumsub-approved user can pay QRs through the corporate pool account)
 * but deposit/withdraw need a real per-user Manteca id — the per-operation
 * split that only Manteca exercises today. See
 * peanut-api-ts/src/kyc/rails.consts.ts (QR_POOL_RAIL_METHOD_CODES).
 */
const CUIT_ACTION_KEY = 'manteca-kyc-action'

const arMantecaPoolTier: KycProfile = {
    id: 'ar-manteca-pool-tier',
    summary: 'AR resident, DNI + selfie, no CUIT → QR pay enabled, bank deposit still locked',
    country: 'AR',
    documents: ['national-id', 'selfie'],
    outcome: 'sumsub GREEN → QR pool rails enabled; BANK_TRANSFER_AR pending full Manteca onboarding',
    identityVerification: verified,
    capabilities: {
        rails: [
            rail('manteca', 'MERCADOPAGO_QR_AR', {
                channel: 'qr-only',
                country: 'AR',
                currency: 'ARS',
                status: 'enabled',
            }),
            rail('manteca', 'BANK_TRANSFER_AR', {
                channel: 'bank',
                country: 'AR',
                currency: 'ARS',
                status: 'requires-info',
                blockingActions: [CUIT_ACTION_KEY],
                reason: {
                    code: 'manteca_tax_id_required',
                    userMessage: 'To deposit from an Argentine bank we need your CUIT.',
                },
                resolved: {
                    status: 'fixable',
                    blocking: {
                        code: 'manteca_tax_id_required',
                        userMessage: 'To deposit from an Argentine bank we need your CUIT.',
                        selfHealable: true,
                        selfHealKind: 'document-resubmit',
                    },
                },
            }),
        ],
        nextActions: [
            {
                key: CUIT_ACTION_KEY,
                kind: 'sumsub',
                purpose: 'unlock-manteca-bank-ar',
                levelKey: 'manteca',
            } satisfies NextAction,
        ],
        restrictions: [],
    },
}

export const KYC_PROFILES = {
    usBridgeApproved,
    euSepaApprovedTriesUs,
    usBridgeNeedsProofOfAddress,
    arMantecaPoolTier,
} satisfies Record<string, KycProfile>

export type KycProfileName = keyof typeof KYC_PROFILES
