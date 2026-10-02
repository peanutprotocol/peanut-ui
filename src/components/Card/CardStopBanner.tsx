'use client'
import { useEffect, type FC } from 'react'
import { useTranslations } from 'next-intl'
import { Callout } from '@/components/0_Bruddle/Callout'
import { useAuth } from '@/context/authContext'
import { useCardStopConfirmation, type StopAttempt } from '@/hooks/useCardStopConfirmation'

interface Props {
    enabled: boolean
    /** The stop a lock/cancel just reported: followed under the modal's own key, so it outlives the modal. */
    attempt?: StopAttempt | null
    /** The attempt got a matching answer that is not a pending or unavailable stop. */
    onSettled?: () => void
}

/**
 * Keeps an unfinished wallet payment stop visible on the card page after the
 * modal or the whole card screen is gone, even with no card left. It never says
 * "stopped". Until a matching read arrives the action's own answer stands, so a
 * failed read keeps the warning.
 */
const CardStopBanner: FC<Props> = ({ enabled, attempt, onSettled }) => {
    const t = useTranslations('card.stop')
    const userId = useAuth().user?.user?.userId
    const mine = attempt?.userId === userId ? attempt : undefined
    const { stop, answered, check } = useCardStopConfirmation({
        enabled: enabled || !!mine,
        attempt: mine ? { id: mine.attemptId, wallet: mine.wallet } : undefined,
    })
    const shown = mine && !answered ? mine.stop : stop
    const key = shown?.state === 'pending' || shown?.state === 'unavailable' ? shown.state : null

    useEffect(() => {
        if (mine && answered && !key) onSettled?.()
    }, [mine, answered, key, onSettled])

    if (!key) return null
    return (
        <Callout
            priority="attention"
            data-testid="card-stop-banner"
            ctas={key === 'pending' ? [{ label: t('checkStatus'), onClick: check }] : undefined}
        >
            {t(key)}
        </Callout>
    )
}

export default CardStopBanner
