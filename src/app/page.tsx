import { LandingPageShell } from '@/components/LandingPage/LandingPageShell'
import { LandingPageCapacitorGate } from '@/components/LandingPage/LandingPageCapacitorGate'
import { LandingPageContent } from '@/components/LandingPage/LandingPageContent'
import { LocaleSuggestion } from '@/components/Marketing/LocaleSuggestion'
import { DEFAULT_LOCALE } from '@/i18n/types'

export default function RootPage() {
    return (
        <>
            <LocaleSuggestion locale={DEFAULT_LOCALE} />
            <LandingPageCapacitorGate>
                <LandingPageShell>
                    <LandingPageContent locale={DEFAULT_LOCALE} />
                </LandingPageShell>
            </LandingPageCapacitorGate>
        </>
    )
}
