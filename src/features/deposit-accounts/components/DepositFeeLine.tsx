'use client'

import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import type { DepositRail } from '../types'
import { useDepositAccountCopy } from '../useDepositAccountCopy'

/** the exchange-rate page, which takes its pair from the URL */
const ratesHref = (currency: string) => `/profile/exchange-rate?from=USD&to=${currency}`

/**
 * What the corridor costs, on the claim screen and on the details screen.
 *
 * One sentence everywhere: Peanut charges nothing, and money that is not
 * already dollars arrives converted. The rate itself is a page of its own, so
 * the line links there rather than quoting a number that moves.
 */
export function DepositFeeLine({ rail }: { rail: DepositRail }) {
    const { t, feeLine } = useDepositAccountCopy()
    const fee = feeLine(rail)

    return (
        <span className="inline">
            {fee.text}{' '}
            {fee.ratesFor && (
                <LinkButton href={ratesHref(fee.ratesFor)} data-testid="deposit-fee-rates">
                    {t('fees.seeRates')}
                </LinkButton>
            )}
        </span>
    )
}
