'use client'

import { useTranslations } from 'next-intl'
import Loading from '@/components/Global/Loading'
import { PixDepositFlow } from '@/features/pix/components/PixDepositFlow'
import { PixPausedScreen } from '@/features/pix/components/PixPausedScreen'
import { PixUnavailableScreen } from '@/features/pix/components/PixUnavailableScreen'
import { usePixRoute } from '@/features/pix/usePixRoute'

/**
 * Add money by Pix (`/add-money/pix`). The backend's deposit route picks the
 * provider, and the one Pix flow serves it. The route also carries every pause
 * (the residence's, a provider's, a currency's), so the page reads no switch.
 */
export function PixAddMoney() {
    const t = useTranslations('addMoney')
    const { route, screen } = usePixRoute('deposit')

    if (screen === 'loading') return <Loading variant="mascot" />
    if (screen === 'paused') return <PixPausedScreen route={route} action="deposits" />
    if (screen === 'flow' && route) return <PixDepositFlow route={route} />
    return <PixUnavailableScreen title={t('title')} route={route} />
}
