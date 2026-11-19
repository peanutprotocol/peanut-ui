import { findKycDocumentPlan, getKycDocumentStatus, getKycFeatures } from '@/app/actions/kyc-workflow'
import type { KYCRegionIntent } from '@/app/actions/types/sumsub.types'
import type { PaperworkVerificationFeature } from '@/app/actions/types/kyc-paperwork-verification.types'
import { PAPERWORK_VERIFICATION_FLOW, type KycDocumentPlan } from '@/app/actions/types/kyc-workflow.types'
import { DEPOSIT_RAILS } from '@/features/deposit-accounts/rails'
import type { DepositCorridor } from '@/features/deposit-accounts/types'
import type { FeatureReport } from '@/types/capabilities'
import { APPROVED_STATUSES } from './paperworkVerification.utils'

export const paperworkVerificationFeaturePath = (feature: PaperworkVerificationFeature) =>
    `/verify?${new URLSearchParams({ feature })}`
// These redirects carry display context only. The API authorizes verification.
export const RESIDENCE_NOT_SUPPORTED_PATH = '/verify?reason=residence_not_supported'

export function identityStartRefusalPath(code?: string): string | null {
    if (code === 'paperwork_verification_required') return '/verify'
    if (code === 'residence_not_supported') return RESIDENCE_NOT_SUPPORTED_PATH
    return null
}

export const paperworkVerificationDocumentPath = () => `/verify?${new URLSearchParams({ step: 'id' })}`
export const VERIFY_RESTART_PARAM = 'restart'
/** The ID screen for a verified user's new identity check, on the documents the restart plan offers. */
export const paperworkVerificationRestartPath = (returnToFeature = false) =>
    `/verify?${new URLSearchParams({
        step: 'id',
        [VERIFY_RESTART_PARAM]: '1',
        ...(returnToFeature ? { returnToFeature: '1' } : {}),
    })}`

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
 * the add-later screen for a feature the API's report says is not opened yet or
 * refused (it asks what the feature still misses, or explains the refusal), or
 * null for today's flow or a feature already underway.
 */
export async function paperworkVerificationRoute(
    plan: KycDocumentPlan | null,
    feature: PaperworkVerificationFeature | null,
    report?: FeatureReport,
    signal?: AbortSignal
): Promise<string | null> {
    if (plan?.unavailableReason === 'residence_not_supported') return RESIDENCE_NOT_SUPPORTED_PATH
    if (!plan || plan.flow === undefined) return '/verify'
    if (plan.flow !== PAPERWORK_VERIFICATION_FLOW) return null
    const status = await getKycDocumentStatus(signal).catch(() => undefined)
    if (signal?.aborted) throw signal.reason
    if (!status || !APPROVED_STATUSES.has(status)) return '/verify'
    if (!feature) return null
    const state = report?.[feature]?.state
    if (!state && typeof plan.features?.[feature] !== 'boolean') return '/verify'
    const opensAddLater = state ? state === 'ready' || state === 'refused' : !plan.features[feature]
    return opensAddLater ? paperworkVerificationFeaturePath(feature) : null
}

/** A Verify entry point: what it unlocks, as the start it would make names it. */
export interface PaperworkVerificationEntry {
    intent?: KYCRegionIntent
    corridor?: DepositCorridor
    targetCountry?: string
}

/**
 * Where an entry point's Verify goes for a Smart Paperwork Verification user,
 * read before any start modal opens. A failed read goes to verification recovery.
 */
export async function paperworkVerificationEntryRoute(entry: PaperworkVerificationEntry): Promise<string | null> {
    // The report read at the tap: fresh, and a failed read falls back to the plan's saved features.
    try {
        const plan = await findKycDocumentPlan('entry')
        const report =
            plan?.flow === PAPERWORK_VERIFICATION_FLOW && !plan.unavailableReason
                ? await Promise.resolve()
                      .then(() => getKycFeatures())
                      .catch(() => undefined)
                : undefined
        return await paperworkVerificationRoute(plan, entryFeature(entry), report)
    } catch (error) {
        return identityStartRefusalPath((error as { code?: string } | null)?.code) ?? '/verify'
    }
}
