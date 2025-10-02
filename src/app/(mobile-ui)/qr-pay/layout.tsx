import { generateMetadata } from '@/app/metadata'
import PageContainer from '@/components/0_Bruddle/PageContainer'
import React from 'react'

export const metadata = generateMetadata({
    title: 'QR Payment | Peanut',
    description: 'Use Peanut to pay Argentinian MercadoPago and Brazilian Pix QR codes',
})

export default function QRPayLayout({ children }: { children: React.ReactNode }) {
    return <PageContainer>{children}</PageContainer>
}
