import { Suspense } from 'react'
import { LandingPageClient } from './LandingPageClient'
import Manteca from './Manteca'
import { RegulatedRails } from './RegulatedRails'
import { YourMoney } from './yourMoney'
import { SecurityBuiltIn } from './securityBuiltIn'
import { SendInSeconds } from './sendInSeconds'
import { ProblemFold } from './ProblemFold'
import Footer from './Footer'
import { faqSchema } from '@/lib/seo/schemas'
import { resolveContentHref, singletonLocaleFor } from '@/lib/content'
import { JsonLd } from '@/components/Marketing/JsonLd'
import { getLandingContent } from '@/lib/landingContent'
import { getTranslations } from '@/i18n'
import { landingStrings } from './landingStrings'
import type { Locale } from '@/i18n/types'
import { EN_LANDING_CONTENT_HREFS, type LandingContentHrefs } from './landingContentHrefs'

// Blue, not Manteca's default cream: on the homepage it follows RegulatedRails,
// which is cream already.
const MANTECA_BG_COLOR = '#90A8ED'

function contentHrefsFor(locale: Locale): LandingContentHrefs {
    return Object.fromEntries(
        Object.entries(EN_LANDING_CONTENT_HREFS).map(([key, href]) => [key, resolveContentHref(href, locale)])
    ) as unknown as LandingContentHrefs
}

// Shared body of the landing page, rendered by / (en) and by each per-locale
// landing route. Reads the filesystem via getLandingContent, so this must stay
// a server component.
export function LandingPageContent({ locale }: { locale: Locale }) {
    const { heroConfig, faqData, marqueeMessages } = getLandingContent(locale)
    const strings = landingStrings(getTranslations(locale))
    const contentHrefs = contentHrefsFor(locale)
    // inLanguage reflects the language the FAQ prose actually resolved to —
    // until mono ships landing translations, that's English on every locale.
    const faqJsonLd = faqSchema(
        faqData.questions.map((q) => ({ question: q.question, answer: q.answer })),
        singletonLocaleFor('landing', locale)
    )

    // The root layout is above the locale segment and can't read route params,
    // so it ships <html lang="en">. Scope the real language here instead — same
    // approach the marketing layout takes on its <main>.
    return (
        <div lang={locale}>
            {faqJsonLd && <JsonLd data={faqJsonLd} />}
            <Suspense>
                <LandingPageClient
                    heroConfig={heroConfig}
                    faqData={faqData}
                    marqueeMessages={marqueeMessages}
                    locale={locale}
                    strings={strings}
                    contentHrefs={contentHrefs}
                    problemSlot={<ProblemFold strings={strings} />}
                    mantecaSlot={<Manteca locale={locale} backgroundColor={MANTECA_BG_COLOR} />}
                    regulatedRailsSlot={<RegulatedRails locale={locale} contentHrefs={contentHrefs} />}
                    yourMoneySlot={<YourMoney locale={locale} contentHrefs={contentHrefs} />}
                    securitySlot={<SecurityBuiltIn locale={locale} contentHrefs={contentHrefs} />}
                    sendInSecondsSlot={<SendInSeconds locale={locale} />}
                    footerSlot={<Footer locale={locale} />}
                />
            </Suspense>
        </div>
    )
}
