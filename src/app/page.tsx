import { LandingPageShell } from '@/components/LandingPage/LandingPageShell'
import { LandingPageCapacitorGate } from '@/components/LandingPage/LandingPageCapacitorGate'
import { LandingPageContent } from '@/components/LandingPage/LandingPageContent'
import { LocaleSuggestion } from '@/components/Marketing/LocaleSuggestion'
import { DEFAULT_LOCALE } from '@/i18n/types'
import { landingMetadata } from '@/lib/seo/landing'

// Without this the page inherits the root layout's bare `canonical: '/'` and
// emits no hreflang, leaving the localized landings' alternates non-reciprocal.
export const metadata = landingMetadata(DEFAULT_LOCALE)

export default function RootPage() {
    return (
        <main data-marketing-locale={DEFAULT_LOCALE} lang={DEFAULT_LOCALE}>
            <LocaleSuggestion locale={DEFAULT_LOCALE} />
            <LandingPageCapacitorGate>
                <LandingPageShell>
                    <LandingPageContent locale={DEFAULT_LOCALE} />
                </LandingPageShell>
            </LandingPageCapacitorGate>
        </main>
    )
}
