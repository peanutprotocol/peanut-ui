'use client'
import { type FC, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Callout } from '@/components/0_Bruddle/Callout'
import { useExpiryCountdown } from '@/hooks/useExpiryCountdown'

interface Props {
    /** `blocked`: nothing could move yet. `remains`: part moved, the rest waits. */
    kind: 'blocked' | 'remains'
    /** When the provider releases the balance. Null: the backend gave no time. */
    retryAtMs: number | null
    /** Called once the time has passed. */
    onOver: () => void
}

/**
 * Why a card cancel has to wait for the card balance, with the time left. The
 * card is unchanged: the provider cannot release the balance yet. Mount it
 * when the refusal arrives, so its clock starts there.
 */
const CardReturnWait: FC<Props> = ({ kind, retryAtMs, onOver }) => {
    const t = useTranslations('card')
    const { timeLeft, isExpired } = useExpiryCountdown(retryAtMs, true)
    useEffect(() => {
        if (isExpired) onOver()
    }, [isExpired, onOver])

    if (isExpired) {
        return (
            <Callout priority="info" data-testid="card-return-wait">
                {t('return.retryNow')}
            </Callout>
        )
    }
    return (
        <Callout priority="attention" data-testid="card-return-wait">
            {timeLeft ? (
                // The callout is role="alert": a text change every second would be
                // read out every second, so screen readers get the fixed sentence.
                <>
                    <span aria-hidden="true">{t(`return.${kind}`, { time: timeLeft })}</span>
                    <span className="sr-only">{t('yourCard.moveWait')}</span>
                </>
            ) : (
                t('yourCard.moveWait')
            )}
        </Callout>
    )
}

export default CardReturnWait
