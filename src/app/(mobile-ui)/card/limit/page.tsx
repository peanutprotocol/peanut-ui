'use client'
import { type FC } from 'react'
import { useTranslations } from 'next-intl'
import PageContainer from '@/components/0_Bruddle/PageContainer'
import Loading from '@/components/Global/Loading'
import { Button } from '@/components/0_Bruddle/Button'
import { useRainCardOverview } from '@/hooks/useRainCardOverview'
import { findActiveCard } from '@/components/Card/cardState.utils'
import CardLimitsScreen from '@/components/Card/CardLimitsScreen'
import { useSafeBack } from '@/hooks/useSafeBack'

const CardLimitPage: FC = () => {
    const t = useTranslations('card')
    const { overview, isLoading } = useRainCardOverview()
    const card = findActiveCard(overview)
    const onBack = useSafeBack('/card')

    if (isLoading) {
        return (
            <PageContainer>
                <div className="flex min-h-[inherit] w-full items-center justify-center">
                    <Loading />
                </div>
            </PageContainer>
        )
    }

    if (!card) {
        return (
            <PageContainer>
                <div className="flex min-h-[inherit] w-full flex-col items-center justify-center gap-4 p-4 text-center">
                    <p className="text-n-1">{t('limits.noActiveCard')}</p>
                    <Button variant="purple" shadowSize="4" onClick={onBack}>
                        {t('backToCard')}
                    </Button>
                </div>
            </PageContainer>
        )
    }

    return (
        <PageContainer>
            <CardLimitsScreen cardId={card.id} onPrev={onBack} />
        </PageContainer>
    )
}

export default CardLimitPage
