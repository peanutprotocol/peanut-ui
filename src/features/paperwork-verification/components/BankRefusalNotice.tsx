'use client'

import { useTranslations } from 'next-intl'
import { Callout } from '@/components/0_Bruddle/Callout'
import { reasonCodeKey, refusalTitleKey } from '@/constants/capability-reason-labels.consts'
import type { FeatureReportEntry } from '@/types/capabilities'

/**
 * The verified timeline ticks "Unlock eligible payments", which is false for
 * bank accounts a provider refused for good (a Bridge duplicate, TASK-24968).
 * This says so, with the same reason line the bank screens show.
 */
export function BankRefusalNotice({ refusal }: { refusal: FeatureReportEntry }) {
    const tIdentity = useTranslations('identity')
    const tDeposit = useTranslations('depositAccounts')
    const reasonKey = reasonCodeKey(refusal.reason)
    // A reason with its own refusal title gets it here too: the duplicate's line no longer names the bank
    // accounts (Aleks, 16 Nov 2026). Every other reason line does, so it stands alone.
    const titleKey = refusalTitleKey(refusal.reason)
    return (
        <Callout
            priority="error"
            offerSupport
            title={titleKey ? tDeposit(titleKey) : undefined}
            data-testid="verify-bank-refused"
        >
            {reasonKey ? tIdentity(reasonKey) : refusal.message}
        </Callout>
    )
}
