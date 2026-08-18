import { generateMetadata as generateMeta } from '@/app/metadata'
import { LandingPageShell } from '@/components/LandingPage/LandingPageShell'
import Footer from '@/components/LandingPage/Footer'
import CardLandingPage from './CardLandingPage'

export const metadata = generateMeta({
    title: 'Card Pioneers | Get Early Access to Peanut Card',
    description:
        'Join Card Pioneers for early access to the Peanut Card. Reserve your spot with $10, earn $5 for every friend who joins, and spend your dollars globally.',
    keywords:
        'peanut card, card pioneers, crypto card, digital dollars, global spending, early access, referral rewards, international card',
    // Without this the page inherits lp/layout.tsx's deliberate `canonical: '/'`
    // (the /lp subtree aliases the root landing page). That policy is wrong for
    // /lp/card specifically: it's a distinct product page sitting in the sitemap.
    canonical: '/lp/card',
})

export default function CardLPPage() {
    return (
        <LandingPageShell>
            <CardLandingPage />
            <Footer />
        </LandingPageShell>
    )
}
