'use client'

import Link from 'next/link'
import type { DepositRail } from '../types'
import { useDepositAccountCopy } from '../useDepositAccountCopy'

/** the exchange-rate page, which takes its pair from the URL. The account's
 *  own currency is the source: a payer sends euros and they arrive as dollars,
 *  so the rate the user wants is <account currency> → USD, not the reverse. */
const ratesHref = (currency: string) => `/profile/exchange-rate?from=${currency}&to=USD`

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
                // A link inside a sentence just underlines its words (design.md):
                // the standalone LinkButton's 44px hit area reached into the
                // lines above and below.
                <Link
                    href={ratesHref(fee.ratesFor)}
                    className="rounded-sm underline hover:text-foreground-primary focus-visible:outline-2 focus-visible:outline-action-focus active:text-foreground-primary"
                    data-testid="deposit-fee-rates"
                >
                    {t('fees.seeRates')}
                </Link>
            )}
        </span>
    )
}
