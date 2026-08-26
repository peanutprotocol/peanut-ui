import { type Metadata } from 'next'
import { generateMetadata as metadataHelper } from '@/app/metadata'

// The page itself is a client component, so its route-specific canonical and
// noindex metadata have to live here. robots.ts also disallows this app route.
export const metadata: Metadata = {
    ...metadataHelper({
        title: 'Identity Verification Complete | Peanut',
        description: 'Your identity verification was submitted successfully.',
        canonical: '/kyc/success',
    }),
    robots: { index: false, follow: false },
}

export default function KycSuccessLayout({ children }: { children: React.ReactNode }) {
    return children
}
