'use client'
import { type FC } from 'react'
import { useRouter } from 'next/navigation'
import PageContainer from '@/components/0_Bruddle/PageContainer'
import Loading from '@/components/Global/Loading'
import { Button } from '@/components/0_Bruddle/Button'
import { useRainCardOverview } from '@/hooks/useRainCardOverview'
import { findActiveCard } from '@/components/Card/cardState.utils'
import PhysicalCardScreen from '@/components/Card/PhysicalCardScreen'

const PhysicalCardPage: FC = () => {
    const router = useRouter()
    const { overview, isLoading } = useRainCardOverview()
    const card = findActiveCard(overview)

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
                    <p className="text-n-1">No active card.</p>
                    <Button variant="purple" shadowSize="4" onClick={() => router.push('/card')}>
                        Back to Card
                    </Button>
                </div>
            </PageContainer>
        )
    }

    return (
        <PageContainer>
            <PhysicalCardScreen cardId={card.id} last4={card.last4} onPrev={() => router.push('/card')} />
        </PageContainer>
    )
}

export default PhysicalCardPage
