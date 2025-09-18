import { generateMetadata } from '@/app/metadata'
import PageContainer from '@/components/0_Bruddle/PageContainer'
import React from 'react'

export const metadata = generateMetadata({
    title: 'Recover Funds',
    description: 'Recover funds that were mistakenly sent to your address in other tokens',
})

export default function RecoverFundsLayout({ children }: { children: React.ReactNode }) {
    return <PageContainer>{children}</PageContainer>
}
