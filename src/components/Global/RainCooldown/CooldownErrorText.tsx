'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRainCooldownEndsAt } from '@/context/RainCooldownContext'
import { useCooldownRemaining } from '@/hooks/useCooldownRemaining'

/**
 * Renders a flow's error message. When it is the card cool-down error, the
 * frozen copy is replaced by a live countdown read from the same end time as
 * the cool-down pill, so the two never disagree. Any other message renders
 * unchanged.
 */
export default function CooldownErrorText({ message }: { message: string }) {
    const t = useTranslations('errors')
    const endsAt = useRainCooldownEndsAt()
    const remaining = useCooldownRemaining(endsAt)
    // remember a live cool-down so its end reads "try again now", not "shortly"
    const [sawCooldown, setSawCooldown] = useState(false)
    useEffect(() => {
        if (endsAt !== null) setSawCooldown(true)
    }, [endsAt])

    // ponytail: matched by copy, not a code — screens store the error as a string
    if (message !== t('rainCooldownRetryShortly')) return <>{message}</>

    if (remaining !== null) {
        // the parent callout is role="alert": a text change every second would
        // be read out every second, so screen readers get the fixed sentence
        return (
            <>
                <span aria-hidden="true">{t('rainCooldownRetryLive', { time: remaining })}</span>
                <span className="sr-only">{message}</span>
            </>
        )
    }
    return <>{sawCooldown ? t('rainCooldownRetryNow') : message}</>
}
