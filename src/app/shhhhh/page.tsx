import { generateMetadata as generateMeta } from '@/app/metadata'
import { LandingPageShell } from '@/components/LandingPage/LandingPageShell'
import Footer from '@/components/LandingPage/Footer'
import ShhhhhLandingPage from './ShhhhhLandingPage'

export const metadata = generateMeta({
    title: 'Shhhhh. | The peanut card is out, quietly.',
    description:
        'A non-custodial card accepted at over 150 million Visa-accepting merchants. We are letting beta users in slowly — about 20 a week.',
    keywords: 'peanut card, non-custodial card, visa-accepting merchants, closed beta, stablecoins',
    canonical: '/shhhhh',
})

export default function ShhhhhPage() {
    return (
        <LandingPageShell>
            <ShhhhhLandingPage />
            <Footer />
        </LandingPageShell>
    )
}
