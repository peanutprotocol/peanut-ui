import { type Metadata } from 'next'

// /lp is an alias for the root landing page — canonical points to /
export const metadata: Metadata = {
    alternates: { canonical: '/' },
}

export default function LpLayout({ children }: { children: React.ReactNode }) {
    return children
}
