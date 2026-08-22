import { Suspense } from 'react'
import { LandingPageClient } from './LandingPageClient'
import { Marquee } from './marquee'
import Manteca from './Manteca'
import { RegulatedRails } from './RegulatedRails'
import { YourMoney } from './yourMoney'
import { SecurityBuiltIn } from './securityBuiltIn'
import { SendInSeconds } from './sendInSeconds'
import { ProblemFold } from './ProblemFold'
import Footer from './Footer'
import { faqSchema } from '@/lib/seo/schemas'
import { singletonLocaleFor } from '@/lib/content'
import { JsonLd } from '@/components/Marketing/JsonLd'
import { getLandingContent } from '@/lib/landingContent'
import { getTranslations } from '@/i18n'
import { landingStrings } from './landingStrings'
import type { Locale } from '@/i18n/types'

// Blue, not Manteca's default cream: on the homepage it follows RegulatedRails,
// which is cream already.
const MANTECA_BG_COLOR = '#90A8ED'

// Shared body of the landing page, rendered by / (en) and by each per-locale
// landing route. Reads the filesystem via getLandingContent, so this must stay
// a server component.
export function LandingPageContent({ locale }: { locale: Locale }) {
    const { heroConfig, faqData, marqueeMessages } = getLandingContent(locale)
    const strings = landingStrings(getTranslations(locale))

    /*
     * Built here rather than in the client component: the same strip renders
     * eleven times down the page, and as a server slot none of them hydrate or
     * re-render with the scroll-driven parent.
     *
     * Only the words with a real article behind them become links; the rest stay
     * plain text. Words come from the content system's marquee list, so an edit
     * there just drops out of this map and renders unlinked.
     */
    const marqueeHrefs: Record<string, string> = {
        'No transfer fees': `/${locale}/pricing`,
        USD: `/${locale}/help/what-are-digital-dollars`,
        EUR: `/${locale}/help/send-euros-argentina`,
        'USDT/USDC': `/${locale}/blog/stablecoin-balance-visa-merchants`,
        GLOBAL: `/${locale}/help/supported-geographies`,
        'SELF-CUSTODIAL': `/${locale}/help/security-custody`,
        // /support is only a permanent redirect to /en/help, so linking it would
        // drop es/pt readers into English while its neighbours stay localized
        '24/7': `/${locale}/help`,
    }
    const marqueeItems = marqueeMessages.map((word) =>
        marqueeHrefs[word] ? { label: word, href: marqueeHrefs[word] } : word
    )
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
                    locale={locale}
                    strings={strings}
                    problemSlot={<ProblemFold strings={strings} />}
                    mantecaSlot={<Manteca locale={locale} backgroundColor={MANTECA_BG_COLOR} />}
                    regulatedRailsSlot={<RegulatedRails locale={locale} />}
                    yourMoneySlot={<YourMoney locale={locale} />}
                    securitySlot={<SecurityBuiltIn locale={locale} />}
                    sendInSecondsSlot={<SendInSeconds locale={locale} />}
                    footerSlot={<Footer locale={locale} />}
                    marqueeSlot={<Marquee message={marqueeItems} />}
                />
            </Suspense>
        </div>
    )
}
