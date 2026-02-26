'use client'

/**
 * /lp route - Landing page that is ALWAYS accessible regardless of auth state.
 * This allows logged-in users to view the marketing landing page.
 * Uses Layout (client) instead of LandingPageShell since SSR doesn't matter here.
 */

import Layout from '@/components/Global/Layout'
import { LandingPageClient } from '@/components/LandingPage/LandingPageClient'
import Manteca from '@/components/LandingPage/Manteca'
import { RegulatedRails } from '@/components/LandingPage/RegulatedRails'
import { YourMoney } from '@/components/LandingPage/yourMoney'
import { SecurityBuiltIn } from '@/components/LandingPage/securityBuiltIn'
import { SendInSeconds } from '@/components/LandingPage/sendInSeconds'
import Footer from '@/components/LandingPage/Footer'
import { heroConfig, faqData, marqueeMessages } from '@/components/LandingPage/landingPageData'

export default function LPPage() {
    return (
        <Layout className="enable-select !m-0 w-full !p-0">
            <LandingPageClient
                heroConfig={heroConfig}
                faqData={faqData}
                marqueeMessages={marqueeMessages}
                mantecaSlot={<Manteca />}
                regulatedRailsSlot={<RegulatedRails />}
                yourMoneySlot={<YourMoney />}
                securitySlot={<SecurityBuiltIn />}
                sendInSecondsSlot={<SendInSeconds />}
                footerSlot={<Footer />}
            />
        </Layout>
    )
}
