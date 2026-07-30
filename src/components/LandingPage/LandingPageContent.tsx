import { Suspense } from 'react'
import { LandingPageClient } from './LandingPageClient'
import Manteca from './Manteca'
import { RegulatedRails } from './RegulatedRails'
import { YourMoney } from './yourMoney'
import { SecurityBuiltIn } from './securityBuiltIn'
import { SendInSeconds } from './sendInSeconds'
import Footer from './Footer'
import { faqSchema } from '@/lib/seo/schemas'
import { JsonLd } from '@/components/Marketing/JsonLd'
import { getLandingContent } from '@/lib/landingContent'
import { getTranslations } from '@/i18n'
import { landingStrings } from './landingStrings'
import type { Locale } from '@/i18n/types'

// Shared body of the landing page, rendered by / (en) and by each per-locale
// landing route. Reads the filesystem via getLandingContent, so this must stay
// a server component.
export function LandingPageContent({ locale }: { locale: Locale }) {
    const { heroConfig, faqData, marqueeMessages } = getLandingContent(locale)
    const faqJsonLd = faqSchema(faqData.questions.map((q) => ({ question: q.question, answer: q.answer })))

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
                    strings={landingStrings(getTranslations(locale))}
                    mantecaSlot={<Manteca locale={locale} />}
                    regulatedRailsSlot={<RegulatedRails locale={locale} />}
                    yourMoneySlot={<YourMoney locale={locale} />}
                    securitySlot={<SecurityBuiltIn locale={locale} />}
                    sendInSecondsSlot={<SendInSeconds locale={locale} />}
                    footerSlot={<Footer locale={locale} />}
                />
            </Suspense>
        </div>
    )
}
