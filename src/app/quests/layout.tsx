import { type Metadata } from 'next'
import { generateMetadata as metadataHelper } from '@/app/metadata'

// Without this the page inherits the root layout's `canonical: '/'`. The route
// is robots-disallowed (app surface) — noindex backs that up for URL-only hits.
export const metadata: Metadata = {
    ...metadataHelper({
        title: 'Quests | Peanut',
        description: 'Complete quests, earn rewards, and get the most out of Peanut.',
        canonical: '/quests',
    }),
    robots: { index: false, follow: false },
}

export default function QuestsLayout({ children }: { children: React.ReactNode }) {
    return children
}
