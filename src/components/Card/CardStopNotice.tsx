'use client'
import type { FC } from 'react'
import { useTranslations } from 'next-intl'
import { Callout } from '@/components/0_Bruddle/Callout'
import { useCardStopConfirmation } from '@/hooks/useCardStopConfirmation'
import type { CardFundingStop } from '@/services/rain'

interface Props {
    stop?: CardFundingStop | null
    /** Identity of this lock/cancel response (see `useCardStopConfirmation`); mount with `key={attemptId}`. */
    attemptId: string
    /** The smart wallet the action ran for. */
    wallet?: string
    /** After an unlock: a stop remains (`kept`), or the backend could not say (`unknown`: unlock again). */
    unlock?: 'kept' | 'unknown'
}

/**
 * What the card lock/cancel/unlock did to payments from the wallet. The card
 * itself is already done; this only says how far the wallet got. "Stopped" is
 * shown only when a funding read made for this attempt confirms it.
 */
const CardStopNotice: FC<Props> = ({ stop, attemptId, wallet, unlock }) => {
    const t = useTranslations('card.stop')
    const {
        stop: live,
        unreadable,
        check,
    } = useCardStopConfirmation({ enabled: stop?.state === 'pending', attempt: { id: attemptId, wallet } })
    // Nothing is managed for this wallet (or an older backend): nothing to claim.
    if (!unlock && (!stop || stop.state === 'not_applicable')) return null

    const key = unlock
        ? unlock === 'kept'
            ? 'unlockKept'
            : 'unlockUnknown'
        : live?.state === 'confirmed'
          ? 'confirmed'
          : stop?.state === 'unavailable' || live?.state === 'unavailable'
            ? 'unavailable'
            : unreadable
              ? 'checkFailed'
              : 'pending'
    const canCheck = key === 'pending' || key === 'checkFailed'
    return (
        <Callout
            priority={key === 'confirmed' ? 'success' : 'attention'}
            data-testid="card-stop-notice"
            ctas={canCheck ? [{ label: t('checkStatus'), onClick: check }] : undefined}
        >
            {t(key)}
        </Callout>
    )
}

export default CardStopNotice
