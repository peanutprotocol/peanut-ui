import { type Metadata } from 'next'
import { generateMetadata as metadataHelper } from '@/app/metadata'

// The page itself is a client component, so its route-specific canonical and
// noindex metadata have to live here. robots.ts also disallows this app route.
export const metadata: Metadata = {
    ...metadataHelper({
        title: 'Support Chat | Peanut',
        description: 'Peanut support chat, embedded in the app.',
        canonical: '/crisp-proxy',
    }),
    robots: { index: false, follow: false },
}

export default function CrispProxyLayout({ children }: { children: React.ReactNode }) {
    return children
}
