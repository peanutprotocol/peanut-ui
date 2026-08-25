'use client'

import { usePathname } from 'next/navigation'
import { notFound } from 'next/navigation'
import { DEV_ROUTES_ENABLED, isBlockedDevRoute } from '@/constants/dev-tools.consts'

// Second layer, for the native app only. That build is a static export, so
// proxy.ts never runs and this is the sole gate there. On the web the proxy
// answers 404 first — a notFound() inside this route group still returns 200.
export default function DevLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()

    if (!DEV_ROUTES_ENABLED && isBlockedDevRoute(pathname ?? '')) {
        notFound()
    }

    return <>{children}</>
}
