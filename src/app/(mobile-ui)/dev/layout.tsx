'use client'

import { usePathname } from 'next/navigation'
import { notFound } from 'next/navigation'
import { shouldBlockDevRoute } from '@/constants/dev-tools.consts'

// Second layer, for the native app only. That build is a static export, so
// proxy.ts never runs and this layout is the gate for this route group —
// src/app/dev/layout.tsx does the same for the other group. On the web the
// proxy answers 404 first; a notFound() inside this route group returns 200.
export default function DevLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()

    if (shouldBlockDevRoute(pathname ?? '')) {
        notFound()
    }

    return <>{children}</>
}
