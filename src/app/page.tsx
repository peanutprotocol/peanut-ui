import { LandingPageShell } from '@/components/LandingPage/LandingPageShell'
import { LandingPageCapacitorGate } from '@/components/LandingPage/LandingPageCapacitorGate'
import { LandingPageContent } from '@/components/LandingPage/LandingPageContent'
import { HtmlLang } from '@/components/Marketing/HtmlLang'
import { LocaleSuggestion } from '@/components/Marketing/LocaleSuggestion'
import { DEFAULT_LOCALE } from '@/i18n/types'
import { landingMetadata } from '@/lib/seo/landing'

// The root layout is deliberately route-neutral. The page owns its canonical
// and hreflang so localized landing alternates stay reciprocal.
export const metadata = landingMetadata(DEFAULT_LOCALE)

export default function RootPage() {
    return (
        <>
            <LocaleSuggestion locale={DEFAULT_LOCALE} />
            <LandingPageCapacitorGate>
                {/* Inside the gate: on native this route is only a bootstrap
                    shell that redirects away, and the device locale — not this
                    page's English — is what <html lang> should report there. */}
                <HtmlLang locale={DEFAULT_LOCALE} />
                <LandingPageShell>
                    <LandingPageContent locale={DEFAULT_LOCALE} />
                </LandingPageShell>
            </LandingPageCapacitorGate>
        </>
    )
}
