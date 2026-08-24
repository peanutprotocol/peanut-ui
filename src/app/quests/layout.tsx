import { type Metadata } from 'next'
import { generateMetadata as metadataHelper } from '@/app/metadata'

// Keep the app route self-canonical and noindex. It is also robots-disallowed;
// metadata backs that up for URL-only hits.
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
