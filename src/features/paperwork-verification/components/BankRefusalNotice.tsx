'use client'

import { useTranslations } from 'next-intl'
import { Callout } from '@/components/0_Bruddle/Callout'
import { reasonCodeKey } from '@/constants/capability-reason-labels.consts'
import type { FeatureReportEntry } from '@/types/capabilities'

/**
 * The verified timeline ticks "Unlock eligible payments", which is false for
 * bank accounts a provider refused for good (a Bridge duplicate, TASK-24968).
 * This says so, with the same reason line the bank screens show.
 */
export function BankRefusalNotice({ refusal }: { refusal: FeatureReportEntry }) {
    const t = useTranslations('kyc.paperworkVerification')
    const tIdentity = useTranslations('identity')
    const tKyc = useTranslations('kyc')
    const reasonKey = reasonCodeKey(refusal.reason)
    return (
        <Callout priority="error" title={t('bankRefused.title')} offerSupport data-testid="verify-bank-refused">
            {reasonKey
                ? tIdentity(reasonKey)
                : (refusal.message ?? tKyc('supplement.unavailable', { feature: tKyc('documents.bank') }))}
        </Callout>
    )
}
