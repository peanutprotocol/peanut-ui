'use client'

import { useFooterVisibility } from '@/context/footerVisibility'
import { useMemo, type ReactNode } from 'react'
// Imported directly, not through the barrel: `export *` pulls every sibling
// into this chunk, including dropLink's nine repeat: Infinity animations,
// which the landing page never renders.
import { Hero } from '@/components/LandingPage/hero'
import { Marquee } from '@/components/LandingPage/marquee'
import { StickyMobileCTA } from '@/components/LandingPage/StickyMobileCTA'
import type { LandingStrings } from './landingStrings'
import { AppModalProvider } from '@/components/Migration/AppModalProvider'
import { LandingDownloadCta } from './LandingDownloadCta'
import { type CTAButton } from '@/components/LandingPage/landing.types'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'
import { useLocale } from 'next-intl'
import type { LandingContentHrefs } from './landingContentHrefs'
import type { MarqueeChip } from '@/lib/landingContent'

type LandingPageClientProps = {
    heroConfig: {
        primaryCta: CTAButton
    }
    marqueeMessages: MarqueeChip[]
    strings: LandingStrings
    contentHrefs: LandingContentHrefs
    /** Every fold between the hero marquee and the footer, rendered on the server. */
    foldsSlot: ReactNode
    footerSlot: ReactNode
}

export function LandingPageClient({
    heroConfig,
    marqueeMessages,
    strings,
    contentHrefs,
    foldsSlot,
    footerSlot,
}: LandingPageClientProps) {
    const { isFooterVisible } = useFooterVisibility()
    const migrationOn = useMigrationFlag()
    const locale = useLocale()

    const primaryCta = migrationOn ? undefined : heroConfig.primaryCta

    // Only the words with a real article behind them become links; the rest
    // stay plain text. Words come from the content system's marquee list and are
    // matched by their English id, so translated chips keep their links and an
    // edit to the en list just drops out of this map and renders unlinked.
    const marqueeProps = useMemo(() => {
        const hrefs: Record<string, string> = {
            'No transfer fees': contentHrefs.pricing,
            USD: contentHrefs.whatAreDigitalDollars,
            EUR: contentHrefs.sendEurosArgentina,
            'USDT/USDC': contentHrefs.stablecoinBalanceVisaMerchants,
            GLOBAL: contentHrefs.supportedGeographies,
            'SELF-CUSTODIAL': contentHrefs.securityCustody,
            // /support is only a permanent redirect to /en/help, so linking it
            // would drop es/pt readers into English while its neighbours stay localized
            '24/7': contentHrefs.help,
        }
        return {
            visible: true,
            message: marqueeMessages.map(({ id, label }) => (hrefs[id] ? { label, href: hrefs[id] } : label)),
        }
    }, [contentHrefs, marqueeMessages])

    // The home folds share one download modal: their app CTAs register home QR slots.
    return (
        <AppModalProvider marketingPage="home" marketingLocale={locale}>
            <Hero
                primaryCta={primaryCta}
                buttonVisible={!isFooterVisible}
                strings={strings}
                customCta={migrationOn ? <LandingDownloadCta subtext={heroConfig.primaryCta.subtext} /> : undefined}
            />
            <Marquee {...marqueeProps} />
            {foldsSlot}
            {footerSlot}
            <StickyMobileCTA strings={strings} />
        </AppModalProvider>
    )
}
