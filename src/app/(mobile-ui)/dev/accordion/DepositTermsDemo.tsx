'use client'

import { Accordion } from '@/components/0_Bruddle/Accordion'
import { DepositFeeLine } from '@/features/deposit-accounts/components/DepositFeeLine'
import { DepositRuleList } from '@/features/deposit-accounts/components/DepositRuleList'
import { DEPOSIT_RAILS } from '@/features/deposit-accounts/rails'
import { useDepositAccountCopy } from '@/features/deposit-accounts/useDepositAccountCopy'

/**
 * "Limits and fees" on the EUR account details screen
 * (DepositAccountDetailsScreen). Already the Accordion, so before and after
 * are the same markup: the extension must not move it by a pixel.
 */
export function DepositTermsDemo() {
    const { t, arrivalDetail } = useDepositAccountCopy()
    const rail = DEPOSIT_RAILS.SEPA_EU
    const lines = [
        { key: 'anyoneAny', text: t('rules.anyoneAny.line'), why: t('rules.anyoneAny.why') },
        { key: 'minimum', text: t('rules.minimum.line', { min: '€1' }), why: t('rules.minimum.why', { min: '€1' }) },
    ]

    return (
        <Accordion type="single" collapsible defaultValue="terms">
            <Accordion.Item value="terms">
                <Accordion.Trigger>{t('details.termsToggle')}</Accordion.Trigger>
                <Accordion.Content className="flex flex-col gap-3">
                    <DepositRuleList lines={lines} />
                    <p className="text-body-xs text-foreground-secondary">
                        <DepositFeeLine rail={rail} />
                    </p>
                    <p className="text-body-xs text-foreground-secondary">{arrivalDetail(rail.corridor)}</p>
                </Accordion.Content>
            </Accordion.Item>
        </Accordion>
    )
}
