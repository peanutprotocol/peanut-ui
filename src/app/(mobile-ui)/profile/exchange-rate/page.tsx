'use client'

import PageContainer from '@/components/0_Bruddle/PageContainer'
import ExchangeRateWidget from '@/components/Global/ExchangeRateWidget'
import NavHeader from '@/components/Global/NavHeader'
import { useRouter } from 'next/navigation'

export default function ExchangeRatePage() {
    const router = useRouter()

    return (
        <PageContainer className="flex flex-col">
            <NavHeader title="Exchange rate & fees" onPrev={() => router.replace('/profile')} />
            <div className="m-auto">
                <ExchangeRateWidget
                    ctaIcon="arrow-down"
                    ctaLabel="Add money to try it"
                    ctaAction={() => router.push('/add-money')}
                />
            </div>
        </PageContainer>
    )
}
