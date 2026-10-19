import { Hero } from '@/components/LandingPage/hero'
import { EN_LANDING_CONTENT_HREFS } from '@/components/LandingPage/landingContentHrefs'
import { landingStrings } from '@/components/LandingPage/landingStrings'
import { getTranslations } from '@/i18n'
import { DEFAULT_LOCALE } from '@/i18n/types'

// Bare render of the REAL main-LP hero for the /dev/ds/marketing frames
// (q4, ruled 2026-10-15): the key visual — Knerd artwork + mascot + doodles on
// pink — leads home and /lp, nowhere else.
export default function KeyVisualHeroPreview() {
    const strings = landingStrings(getTranslations(DEFAULT_LOCALE))
    return (
        <main className="bg-background-page">
            <Hero
                strings={strings}
                contentHrefs={EN_LANDING_CONTENT_HREFS}
                primaryCta={{ label: strings.signUp, href: '/setup' }}
                buttonVisible
            />
        </main>
    )
}
