'use client'

import { usePathname } from 'next/navigation'
import { notFound } from 'next/navigation'
import { BASE_URL } from '@/constants/general.consts'

// Routes allowed on peanut.me (production). All /dev routes are available elsewhere
// (localhost, staging, Vercel preview deploys).
const PRODUCTION_ALLOWED_ROUTES = ['/dev/full-graph', '/dev/payment-graph']

const IS_PROD_DOMAIN = BASE_URL === 'https://peanut.me'

export default function DevLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()

    // On peanut.me, only allow specific routes (full-graph, payment-graph)
    // On staging, Vercel previews, and localhost, all /dev routes are accessible
    if (IS_PROD_DOMAIN) {
        const isAllowedInProd = PRODUCTION_ALLOWED_ROUTES.some((route) => pathname?.startsWith(route))
        if (!isAllowedInProd) {
            notFound()
        }
    }

    return <>{children}</>
}
