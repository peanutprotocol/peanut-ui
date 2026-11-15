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
    const tIdentity = useTranslations('identity')
    const reasonKey = reasonCodeKey(refusal.reason)
    // No title: every reason line already names the bank accounts, and the API sends a message with every rail reason.
    return (
        <Callout priority="error" offerSupport data-testid="verify-bank-refused">
            {reasonKey ? tIdentity(reasonKey) : refusal.message}
        </Callout>
    )
}
