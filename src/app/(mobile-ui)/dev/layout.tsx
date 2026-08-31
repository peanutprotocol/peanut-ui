'use client'

import { usePathname } from 'next/navigation'
import { notFound } from 'next/navigation'
import { BASE_URL } from '@/constants/general.consts'

// Routes allowed on peanut.me (production). All /dev routes are available elsewhere
// (localhost, staging, Vercel preview deploys).
// full-graph is deliberately absent: the legacy page loads the same team-gated
// dataset without the explorer's telemetry suppression.
// safe-area is read-only diagnostics and has to run on the production native build,
// which is where the devices with the reported oversized inset actually are
const PRODUCTION_ALLOWED_ROUTES = ['/dev/payment-graph', '/dev/safe-area']

const IS_PROD_DOMAIN = BASE_URL === 'https://peanut.me'

export default function DevLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()

    // On peanut.me, only allow specific routes (payment-graph, safe-area)
    // On staging, Vercel previews, and localhost, all /dev routes are accessible
    if (IS_PROD_DOMAIN) {
        const isAllowedInProd = PRODUCTION_ALLOWED_ROUTES.some((route) => pathname?.startsWith(route))
        if (!isAllowedInProd) {
            notFound()
        }
    }

    return <>{children}</>
}
