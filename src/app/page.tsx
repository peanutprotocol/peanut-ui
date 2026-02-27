import { Suspense } from 'react'
import { LandingPageShell } from '@/components/LandingPage/LandingPageShell'
import { LandingPageClient } from '@/components/LandingPage/LandingPageClient'
import Manteca from '@/components/LandingPage/Manteca'
import { RegulatedRails } from '@/components/LandingPage/RegulatedRails'
import { YourMoney } from '@/components/LandingPage/yourMoney'
import { SecurityBuiltIn } from '@/components/LandingPage/securityBuiltIn'
import { SendInSeconds } from '@/components/LandingPage/sendInSeconds'
import Footer from '@/components/LandingPage/Footer'
import { faqSchema } from '@/lib/seo/schemas'
import { JsonLd } from '@/components/Marketing/JsonLd'
import { heroConfig, faqData, marqueeMessages } from '@/components/LandingPage/landingPageData'

export default function LandingPage() {
    const faqJsonLd = faqSchema(faqData.questions.map((q) => ({ question: q.question, answer: q.answer })))

    return (
        <LandingPageShell>
            {faqJsonLd && <JsonLd data={faqJsonLd} />}
            <Suspense>
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
            </Suspense>
        </LandingPageShell>
    )
}
