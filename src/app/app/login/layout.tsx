import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { STORE_URL } from '@/constants/migration.consts'

// Safari's banner can open an installed app even when same-domain links stay on the web.
export const metadata: Metadata = {
    itunes: {
        appId: STORE_URL.ios.split('/id')[1],
        appArgument: 'https://peanut.me/app',
    },
}

export default function AppHandoffLayout({ children }: { children: ReactNode }) {
    return children
}
