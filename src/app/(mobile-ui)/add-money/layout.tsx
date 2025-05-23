import PageContainer from '@/components/0_Bruddle/PageContainer'
import React from 'react'

export default function AddMoneyLayout({ children }: { children: React.ReactNode }) {
    return <PageContainer className="min-h-[inherit] self-start">{children}</PageContainer>
}
