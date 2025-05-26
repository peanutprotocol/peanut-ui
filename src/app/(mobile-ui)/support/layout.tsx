import React from 'react'

import { generateMetadata } from '@/app/metadata'

export const metadata = generateMetadata({
    title: 'Support | Peanut - Instant Global P2P Payments',
    description:
        'Get help and support for Peanut. Find answers to your questions about our P2P digital dollar payment app for fast, global transfers.',
})

export default function SupportLayout({ children }: { children: React.ReactNode }) {
    return children
}
