import { generateMetadata as generateMeta } from '@/app/metadata'
import { LandingPageShell } from '@/components/LandingPage/LandingPageShell'
import Footer from '@/components/LandingPage/Footer'
import ShhhhhLandingPage from './ShhhhhLandingPage'

export const metadata = generateMeta({
    title: 'Peanut Card | Get your card',
    description: 'Get your Peanut Card for online and contactless payments. Verification and approval required.',
    keywords: 'peanut card, visa-accepting merchants, virtual card, stablecoins',
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
