'use client'
import { type FC } from 'react'
import { useRouter } from 'next/navigation'
import PageContainer from '@/components/0_Bruddle/PageContainer'
import AddToWalletCarousel from '@/components/Card/AddToWalletCarousel'

const AddToWalletPage: FC = () => {
    const router = useRouter()
    return (
        <PageContainer>
            <AddToWalletCarousel onDone={() => router.push('/card')} onPrev={() => router.push('/card')} />
        </PageContainer>
    )
}

export default AddToWalletPage
