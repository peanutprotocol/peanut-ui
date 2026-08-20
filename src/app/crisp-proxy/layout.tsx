import { type Metadata } from 'next'
import { generateMetadata as metadataHelper } from '@/app/metadata'

// The page itself is a client component, so its metadata has to live here.
// Without it the route inherits the root layout's `canonical: '/'` and declares
// the homepage as its canonical while serving `index, follow` — on a route
// robots.ts already disallows.
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
