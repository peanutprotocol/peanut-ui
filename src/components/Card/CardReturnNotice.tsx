'use client'
import type { FC } from 'react'
import { useTranslations } from 'next-intl'
import { Callout } from '@/components/0_Bruddle/Callout'
import { cardReturnFacts, formatCardCents } from '@/components/Card/cardReturn.utils'
import type { CardCollateralReturn } from '@/services/rain'

interface Props {
    /** The action that already went through. */
    action: 'lock' | 'cancel'
    collateralReturn?: CardCollateralReturn | null
}

/**
 * What a finished lock or cancel left in the card. A freeze is never refused,
 * so a frozen card can still hold the user's balance; a cancel leaves only
 * what is reserved for pending payments, and refund credit. Says nothing when
 * the whole balance moved, or on a backend that does not report it.
 */
const CardReturnNotice: FC<Props> = ({ action, collateralReturn }) => {
    const t = useTranslations('card.return')
    const facts = cardReturnFacts(collateralReturn)
    if (!facts) return null

    const isLock = action === 'lock'
    const lines: string[] = []
    // A cancel is refused while the user's balance is in the card, so only a lock reports it.
    if (isLock && facts.leftCents > 0) lines.push(t('lockLeft', { amount: formatCardCents(facts.leftCents) }))
    if (isLock && facts.unknown) lines.push(t('lockUnknown'))
    if (facts.heldCents > 0) lines.push(t('held', { amount: formatCardCents(facts.heldCents) }))
    if (facts.creditCents > 0) {
        lines.push(t(isLock ? 'lockCredit' : 'cancelCredit', { amount: formatCardCents(facts.creditCents) }))
    }
    if (lines.length === 0) return null

    const needsAttention = isLock && (facts.leftCents > 0 || facts.unknown)
    return (
        <Callout priority={needsAttention ? 'attention' : 'info'} data-testid="card-return-notice">
            <div className="flex flex-col gap-1">
                {lines.map((line) => (
                    <p key={line}>{line}</p>
                ))}
            </div>
        </Callout>
    )
}

export default CardReturnNotice
