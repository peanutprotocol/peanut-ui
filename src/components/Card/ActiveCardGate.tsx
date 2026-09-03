'use client'
import { type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import PageContainer from '@/components/0_Bruddle/PageContainer'
import Loading from '@/components/Global/Loading'
import { Button } from '@/components/0_Bruddle/Button'
import { useRainCardOverview } from '@/hooks/useRainCardOverview'
import { findActiveCard } from '@/components/Card/cardState.utils'
import { useSafeBack } from '@/hooks/useSafeBack'
import type { RainCardSummary } from '@/services/rain'

type CardMessageKey = Parameters<ReturnType<typeof useTranslations<'card'>>>[0]

interface ActiveCardGateProps {
    /** i18n key under `card` for the no-active-card message */
    noCardMessageKey?: CardMessageKey
    children: (card: RainCardSummary, onBack: () => void) => ReactNode
}

/**
 * Shared shell for the /card subpages (pin, limit, physical): loading gate,
 * no-active-card gate with a back CTA, then the screen with the active card.
 * The three pages carried this 40-line shell verbatim each.
 */
const ActiveCardGate = ({ noCardMessageKey = 'noActiveCard', children }: ActiveCardGateProps) => {
    const t = useTranslations('card')
    const { overview, isLoading } = useRainCardOverview()
    const card = findActiveCard(overview)
    const onBack = useSafeBack('/card')

    if (isLoading) {
        return (
            <PageContainer>
                <div className="flex min-h-inherit w-full items-center justify-center">
                    <Loading />
                </div>
            </PageContainer>
        )
    }

    if (!card) {
        return (
            <PageContainer>
                <div className="flex min-h-inherit w-full flex-col items-center justify-center gap-4 p-4 text-center">
                    <p className="text-foreground-primary">{t(noCardMessageKey)}</p>
                    <Button variant="purple" shadowSize="4" onClick={onBack}>
                        {t('backToCard')}
                    </Button>
                </div>
            </PageContainer>
        )
    }

    return <PageContainer>{children(card, onBack)}</PageContainer>
}

export default ActiveCardGate
