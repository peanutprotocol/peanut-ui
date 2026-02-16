import { generateMetadata as generateMeta } from '@/app/metadata'
import CardLandingPage from './CardLandingPage'

export const metadata = generateMeta({
    title: 'Card Pioneers | Get Early Access to Peanut Card',
    description:
        'Join Card Pioneers for early access to the Peanut Card. Reserve your spot with $10, earn $5 for every friend who joins, and spend your dollars globally.',
    keywords:
        'peanut card, card pioneers, crypto card, digital dollars, global spending, early access, referral rewards, international card',
})

export default function CardLPPage() {
    return <CardLandingPage />
}
