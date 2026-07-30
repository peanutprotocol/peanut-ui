// Literal segment rather than a `[locale]` dynamic route: `[locale]/page.tsx`
// would match any single path segment and shadow `[...recipient]`, breaking
// every peanut.me/{username} profile URL.
import { type Metadata } from 'next'
import { LandingPageShell } from '@/components/LandingPage/LandingPageShell'
import { LandingPageCapacitorGate } from '@/components/LandingPage/LandingPageCapacitorGate'
import { LandingPageContent } from '@/components/LandingPage/LandingPageContent'
import { LocaleSuggestion } from '@/components/Marketing/LocaleSuggestion'
import { landingMetadata } from '@/lib/seo/landing'

const LOCALE = 'es-419' as const

export const metadata: Metadata = landingMetadata(LOCALE)

export default function EsLatamLandingPage() {
    return (
        <>
            <LocaleSuggestion locale={LOCALE} />
            <LandingPageCapacitorGate>
                <LandingPageShell>
                    <LandingPageContent locale={LOCALE} />
                </LandingPageShell>
            </LandingPageCapacitorGate>
        </>
    )
}
