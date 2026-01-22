'use client'

import { usePathname } from 'next/navigation'
import { notFound } from 'next/navigation'
import { IS_DEV } from '@/constants/general.consts'

// Routes that are allowed in production (protected by API key / user check)
const PRODUCTION_ALLOWED_ROUTES = ['/dev/full-graph', '/dev/payment-graph']

export default function DevLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()

    // In production, only allow specific routes (full-graph, payment-graph)
    // Other dev tools (leaderboard, shake-test, dev index) are dev-only
    if (!IS_DEV) {
        const isAllowedInProd = PRODUCTION_ALLOWED_ROUTES.some((route) => pathname?.startsWith(route))
        if (!isAllowedInProd) {
            notFound()
        }
    }

    return <>{children}</>
}
