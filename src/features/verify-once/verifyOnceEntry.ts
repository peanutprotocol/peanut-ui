import { getKycDocumentStatus } from '@/app/actions/kyc-workflow'
import type { KYCRegionIntent } from '@/app/actions/types/sumsub.types'
import type { VerifyOnceFeature } from '@/app/actions/types/kyc-verify-once.types'
import type { KycDocumentPlan } from '@/app/actions/types/kyc-workflow.types'
import { DEPOSIT_RAILS } from '@/features/deposit-accounts/rails'
import type { DepositCorridor } from '@/features/deposit-accounts/types'
import { isVerifyOnceEnabled } from './verifyOnceFlag'

const NEEDS_TODAYS_FIX = new Set(['ACTION_REQUIRED', 'REJECTED', 'FAILED'])

/**
 * The feature an entry point unlocks, for the add-later screen. Bridge bank
 * accounts only in this slice: local transfers (Manteca) keep today's flow.
 */
export function entryFeature({
    intent,
    corridor,
    targetCountry,
}: {
    intent?: KYCRegionIntent
    corridor?: DepositCorridor
    targetCountry?: string
}): VerifyOnceFeature | null {
    if (targetCountry) return null
    if (corridor) return DEPOSIT_RAILS[corridor]?.provider === 'bridge' ? 'bank' : null
    return intent === 'EU' || intent === 'NA' ? 'bank' : null
}

/**
 * Where a Verify tap goes for a verify-once user: /verify before approval,
 * the add-later screen for a feature not yet saved, or null for today's flow
 * (flag off, the server keeps the user on it, a rejection to fix, or nothing
 * new to add).
 */
export async function verifyOnceRoute(
    plan: KycDocumentPlan | null,
    feature: VerifyOnceFeature | null
): Promise<string | null> {
    if (plan?.flow !== 'verify-once' || !isVerifyOnceEnabled()) return null
    const status = await getKycDocumentStatus().catch(() => undefined)
    if (status && NEEDS_TODAYS_FIX.has(status)) return null
    if (status !== 'APPROVED') return '/verify'
    return feature && !plan.features[feature] ? `/verify?feature=${feature}` : null
}
