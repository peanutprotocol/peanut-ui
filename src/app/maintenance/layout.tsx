import { type Metadata } from 'next'
import { generateMetadata as metadataHelper } from '@/app/metadata'

// The page itself is a client component, so its metadata has to live here.
// Without it the route inherits the root layout's `canonical: '/'` and declares
// the homepage as its canonical while serving `index, follow` — on a route
// robots.ts already disallows.
export const metadata: Metadata = {
    ...metadataHelper({
        title: 'Maintenance | Peanut',
        description: 'Peanut is temporarily offline for maintenance.',
        canonical: '/maintenance',
    }),
    robots: { index: false, follow: false },
}

export default function MaintenanceLayout({ children }: { children: React.ReactNode }) {
    return children
}
