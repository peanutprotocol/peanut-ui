import { findKycDocumentPlan, getKycDocumentStatus } from '@/app/actions/kyc-workflow'
import type { KYCRegionIntent } from '@/app/actions/types/sumsub.types'
import type { PaperworkVerificationFeature } from '@/app/actions/types/kyc-paperwork-verification.types'
import { PAPERWORK_VERIFICATION_FLOW, type KycDocumentPlan } from '@/app/actions/types/kyc-workflow.types'
import { DEPOSIT_RAILS } from '@/features/deposit-accounts/rails'
import type { DepositCorridor } from '@/features/deposit-accounts/types'
import { APPROVED_STATUSES } from './paperworkVerification.utils'

// A FAILED check decided nothing, so /verify offers the retry; a rejection is fixed in today's flow.
const NEEDS_TODAYS_FIX = new Set(['REJECTED'])

export const paperworkVerificationFeaturePath = (feature: PaperworkVerificationFeature) =>
    `/verify?${new URLSearchParams({ feature })}`
export const paperworkVerificationDocumentPath = () => `/verify?${new URLSearchParams({ step: 'id' })}`
export const VERIFY_RESTART_PARAM = 'restart'
/** The ID screen for a verified user's new identity check, on the documents the restart plan offers. */
export const paperworkVerificationRestartPath = () =>
    `/verify?${new URLSearchParams({ step: 'id', [VERIFY_RESTART_PARAM]: '1' })}`

/** The feature an entry point unlocks, for the add-later screen: Bridge bank accounts or Manteca local transfers. */
export function entryFeature({
    intent,
    corridor,
    targetCountry,
}: {
    intent?: KYCRegionIntent
    corridor?: DepositCorridor
    targetCountry?: string
}): PaperworkVerificationFeature | null {
    if (targetCountry === 'AR' || targetCountry === 'BR') return 'local'
    if (corridor) {
        const provider = DEPOSIT_RAILS[corridor]?.provider
        return provider === 'manteca' ? 'local' : provider === 'bridge' ? 'bank' : null
    }
    if (intent === 'LATAM') return 'local'
    return intent === 'EU' || intent === 'NA' ? 'bank' : null
}

/**
 * Where a Verify tap goes for a Smart Paperwork Verification user: /verify before approval,
 * the add-later screen for a feature not yet saved, or null for today's flow
 * (the server keeps the user on it, a rejection to fix, or nothing new to add).
 */
export async function paperworkVerificationRoute(
    plan: KycDocumentPlan | null,
    feature: PaperworkVerificationFeature | null
): Promise<string | null> {
    if (plan?.flow !== PAPERWORK_VERIFICATION_FLOW) return null
    const status = await getKycDocumentStatus().catch(() => undefined)
    if (status && NEEDS_TODAYS_FIX.has(status)) return null
    if (!status || !APPROVED_STATUSES.has(status)) return '/verify'
    return feature && !plan.features[feature] ? paperworkVerificationFeaturePath(feature) : null
}

/** A Verify entry point: what it unlocks, as the start it would make names it. */
export interface PaperworkVerificationEntry {
    intent?: KYCRegionIntent
    corridor?: DepositCorridor
    targetCountry?: string
}

/**
 * Where an entry point's Verify goes for a Smart Paperwork Verification user,
 * read before any start modal opens; null keeps today's start. A plan that
 * cannot be read keeps it too: that start reads the plan again, and refuses to
 * open a legacy applicant while it still cannot.
 */
export async function paperworkVerificationEntryRoute(entry: PaperworkVerificationEntry): Promise<string | null> {
    const plan = await findKycDocumentPlan('entry').catch(() => null)
    return paperworkVerificationRoute(plan, entryFeature(entry))
}
