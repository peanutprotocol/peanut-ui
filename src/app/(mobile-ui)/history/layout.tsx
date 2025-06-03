import React from 'react'

import { generateMetadata } from '@/app/metadata'

export const metadata = generateMetadata({
    title: 'History | Peanut',
    description:
        'View your transaction history with Peanut. Track your P2P digital dollar payments, transfers, and claims.',
})

export default function HistoryLayout({ children }: { children: React.ReactNode }) {
    return children
}
