import { generateMetadata } from '@/app/metadata'
import PageContainer from '@/components/0_Bruddle/PageContainer'
import React from 'react'

export const metadata = generateMetadata({
    title: 'QR Payment | Peanut',
    description:
        'Process QR payments with Peanut. Support for PIX, QR 3.0, and CODI payments through Manteca integration.',
})

export default function QRPayLayout({ children }: { children: React.ReactNode }) {
    return <PageContainer>{children}</PageContainer>
}
