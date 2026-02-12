'use client'

import { usePathname } from 'next/navigation'
import { notFound } from 'next/navigation'
import { IS_PRODUCTION } from '@/constants/general.consts'

// Routes allowed on peanut.me (production). All /dev routes are available on staging + localhost.
const PRODUCTION_ALLOWED_ROUTES = ['/dev/full-graph', '/dev/payment-graph']

export default function DevLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()

    // On peanut.me, only allow specific routes (full-graph, payment-graph)
    // On staging.peanut.me and localhost, all /dev routes are accessible
    if (IS_PRODUCTION) {
        const isAllowedInProd = PRODUCTION_ALLOWED_ROUTES.some((route) => pathname?.startsWith(route))
        if (!isAllowedInProd) {
            notFound()
        }
    }

    return <>{children}</>
}
