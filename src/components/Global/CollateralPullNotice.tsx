'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Notification } from '@/components/0_Bruddle/Notification'
import { useCollateralPullPreview } from '@/hooks/wallet/useCollateralPullPreview'
import { formatLockRemaining } from '@/utils/collateralPull.utils'

interface Props {
    amountUsd: string | number | null | undefined
    className?: string
}

const formatDollars = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`

function LockCountdown({ endsAt }: { endsAt: number }) {
    const t = useTranslations('global.collateralPull')
    const [now, setNow] = useState(() => Date.now())
    useEffect(() => {
        const id = window.setInterval(() => setNow(Date.now()), 1000)
        return () => window.clearInterval(id)
    }, [])
    const remaining = endsAt - now
    if (remaining <= 0) return null
    return <> {t('lockActive', { time: formatLockRemaining(remaining) })}</>
}

/**
 * Drop-in for any amount / review step: says, before the passkey, that this
 * spend will pull from the card balance, and how long the card's withdrawal
 * lock still has to run if one is armed. Renders nothing for users without a
 * card, for amounts the off-card balance covers, and for true shortfalls
 * (the insufficient-balance error owns those).
 */
export function CollateralPullNotice({ amountUsd, className }: Props) {
    const t = useTranslations('global.collateralPull')
    const { visible, fromCardCents, cooldownEndsAt } = useCollateralPullPreview(amountUsd)
    if (!visible) return null
    return (
        <div className={className} data-testid="collateral-pull-notice">
            <Notification priority={cooldownEndsAt ? 'attention' : 'info'}>
                {t('fromCard', { amount: formatDollars(fromCardCents) })}
                {cooldownEndsAt && <LockCountdown endsAt={cooldownEndsAt} />}
            </Notification>
        </div>
    )
}

export default CollateralPullNotice
