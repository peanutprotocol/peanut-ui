import { generateMetadata } from '@/app/metadata'
import PageContainer from '@/components/0_Bruddle/PageContainer'
import React from 'react'

export const metadata = generateMetadata({
    title: 'Add Money | Peanut',
    description:
        'Add funds to your Peanut account to start sending and receiving digital dollars instantly. Various methods available for your convenience.',
})

export default function AddMoneyLayout({ children }: { children: React.ReactNode }) {
    return <PageContainer className="min-h-[inherit] self-start">{children}</PageContainer>
}
