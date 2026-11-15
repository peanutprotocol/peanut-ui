import { type Metadata } from 'next'
import { smartAppBanner } from '@/app/metadata'

// /lp is an alias for the root landing page — canonical points to /
export const metadata: Metadata = {
    alternates: { canonical: '/' },
    itunes: smartAppBanner('/'),
}

export default function LpLayout({ children }: { children: React.ReactNode }) {
    return children
}
