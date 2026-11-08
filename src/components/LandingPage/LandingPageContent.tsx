import { Suspense } from 'react'
import { LandingPageClient } from './LandingPageClient'
import { HomeFolds } from './HomeFolds'
import Footer from './Footer'
import { getLandingContent } from '@/lib/landingContent'
import { getTranslations } from '@/i18n'
import { landingStrings } from './landingStrings'
import type { Locale } from '@/i18n/types'
import { contentHrefsFor } from './landingContentHrefs.server'

// Shared body of the landing page, rendered by / (en) and by each per-locale
// landing route. Reads the filesystem via getLandingContent, so this must stay
// a server component.
export function LandingPageContent({ locale }: { locale: Locale }) {
    const { heroConfig, faqData, marqueeMessages } = getLandingContent(locale)
    const strings = landingStrings(getTranslations(locale))

    const contentHrefs = contentHrefsFor(locale)

    // Only some answers have a single article worth linking.
    const learnMoreHrefs: Record<string, string> = {
        // Keep the pinned content's numbered IDs until the content pin changes.
        '1': contentHrefs.whatAreDigitalDollars,
        '2': contentHrefs.verification,
        '3': contentHrefs.passkeys,
        '4': contentHrefs.securityCustody,
        '5': contentHrefs.feesPricing,
        'who-can-pay': contentHrefs.depositBank,
        cost: contentHrefs.feesPricing,
        'local-bank': contentHrefs.supportedGeographies,
        custody: contentHrefs.securityCustody,
    }
    const faqItems = faqData.questions.map((question) => ({
        ...question,
        ...(learnMoreHrefs[question.id] ? { learnMoreHref: learnMoreHrefs[question.id] } : {}),
    }))

    // The root layout is above the locale segment and can't read route params,
    // so it ships <html lang="en">. Scope the real language here instead — same
    // approach the marketing layout takes on its <main>.
    return (
        <div lang={locale}>
            <Suspense>
                <LandingPageClient
                    heroConfig={heroConfig}
                    marqueeMessages={marqueeMessages}
                    strings={strings}
                    contentHrefs={contentHrefs}
                    foldsSlot={
                        <HomeFolds
                            locale={locale}
                            strings={strings}
                            contentHrefs={contentHrefs}
                            faqItems={faqItems}
                            closeCta={{ label: heroConfig.primaryCta.label }}
                        />
                    }
                    footerSlot={<Footer locale={locale} padForStickyCta />}
                />
            </Suspense>
        </div>
    )
}
