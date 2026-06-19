import { generateMetadata } from '@/app/metadata'
import PageContainer from '@/components/0_Bruddle/PageContainer'
import React from 'react'

// Standalone (outside the (mobile-ui) auth shell) on purpose: this page is for
// users who CANNOT log in, so it must not sit behind the login gate. noindex —
// it's reached only via a one-off ops-generated recovery link.
export const metadata = {
    ...generateMetadata({
        title: 'Wallet Recovery',
        description: 'Recover funds from a Peanut wallet using your passkey.',
    }),
    robots: { index: false, follow: false },
}

export default function RecoverWalletLayout({ children }: { children: React.ReactNode }) {
    return <PageContainer>{children}</PageContainer>
}
