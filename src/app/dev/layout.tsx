'use client'

import { usePathname } from 'next/navigation'
import { notFound } from 'next/navigation'
import { shouldBlockDevRoute } from '@/constants/dev-tools.consts'

// Second layer, for the native app only — the twin of
// src/app/(mobile-ui)/dev/layout.tsx. That build is a static export, so
// proxy.ts never runs; without this layout the pages in this group
// (kyc-flows, loading-words) answer in the production native app.
export default function DevLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()

    if (shouldBlockDevRoute(pathname ?? '')) {
        notFound()
    }

    return <>{children}</>
}
