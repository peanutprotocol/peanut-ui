import { generateMetadata } from '@/app/metadata'
import PageContainer from '@/components/0_Bruddle/PageContainer'
import React from 'react'

export const metadata = generateMetadata({
    title: 'Withdraw Funds | Peanut',
    description:
        'Easily withdraw your digital dollars with Peanut. Cash out to local bank accounts or other supported methods quickly and securely.',
})

export default function WithdrawLayout({ children }: { children: React.ReactNode }) {
    return <PageContainer className="min-h-[inherit] self-start">{children}</PageContainer>
}
