import { Band } from '@/components/Marketing/StarLp/Band'
import { SectionTitle } from '@/components/Marketing/StarLp/SectionTitle'
import { StarLpCta } from '@/components/Marketing/StarLp/StarLpCta'
import { StarLpFaq } from '@/components/Marketing/StarLp/StarLpFaq'
import { StarLpHero } from '@/components/Marketing/StarLp/StarLpHero'
import { StarLpMarquee } from '@/components/Marketing/StarLp/StarLpMarquee'
import { TrustBand } from '@/components/Marketing/StarLp/TrustBand'
import { STAR_LP_HREF, STAR_LP_TRUST_LINE } from '@/components/Marketing/StarLp/starLp.consts'
import type { StarLpFaqItem } from '@/components/Marketing/StarLp/starLp.types'
import { fetchUsdArsRate } from '@/components/Marketing/StarLp/starLpFx'
import { QrArgentinaClose } from './QrArgentinaClose'
import { QrArgentinaGroupChat } from './QrArgentinaGroupChat'
import { QrArgentinaHeroArt } from './QrArgentinaHeroArt'
import { QrArgentinaMotionStyle } from './QrArgentinaMotionStyle'
import { QrArgentinaRateFold } from './QrArgentinaRateFold'
import { QrArgentinaTheirScreen } from './QrArgentinaTheirScreen'
import { QR_AR_THEIR_SCREEN_ID } from './qrArgentina.consts'

// Wording from the build brief's claims list (spending.md, kyc.md, the
// guardrail-13 card line). The passport line is about QR payments only.
const FAQ: StarLpFaqItem[] = [
    {
        id: 'account',
        question: 'Do I need a Mercado Pago account or a local bank?',
        answer: 'No. Verify once with your passport and a selfie, add dollars, then scan.',
    },
    {
        id: 'which-qrs',
        question: 'Which QRs can I pay?',
        answer: "Mercado Pago QRs. MODO and Cuenta DNI QRs aren't supported yet.",
    },
    {
        id: 'limit',
        question: 'Is there a limit?',
        answer: 'Up to USD 2,000 per payment. Monthly limits apply too.',
    },
    {
        id: 'card',
        question: 'How does it compare to my card?',
        answer: 'Skip foreign card transaction fees. Pay by QR with Peanut. Card fees and exchange rates vary.',
    },
]

// Marquee words: spending.md, kyc.md and the FAQ. Plain words only.
const HERO_SEAM: string[] = ['Mercado Pago QRs', 'Your passport', 'Pay from dollars', 'Pesos at the till']
const REVIEW_SEAM: string[] = ['Scan', 'Check the pesos', 'Confirm', 'Paid']
const SCREEN_SEAM: string[] = ['Split the bill', 'Pay back friends', 'Group dinners', 'Peanut to Peanut']
const TRUST_SEAM: string[] = [
    'Up to USD 2,000 per payment',
    'No local bank',
    'No Mercado Pago account',
    'Rate shown first',
]
// The card saving is the rate fold's dated example with its footnote (pricing.md); no strip carries a number.
const CLOSE_SEAM: string[] = ['Self-custodial', 'Passkey', 'Dollars', 'Pay by QR']

/**
 * /qr-payments/argentina: pay Mercado Pago QRs with a passport (mock r4-qr-argentina-a4, folds 0–5).
 * Folds: pink, cream, sky, pink, cream, black, pink, footer. Every seam with a
 * coloured side carries a marquee except the dinner fold's into the FAQ (a pink
 * fold was black; the marquee count stayed); the FAQ/trust-band seam has none.
 */
export async function QrArgentinaLanding() {
    // Live Manteca USD→ARS, the rate the QR payment executes at; null hides the dollar line.
    const usdArs = await fetchUsdArsRate()
    return (
        <>
            <QrArgentinaMotionStyle />
            <StarLpHero
                lead="No DNI?"
                knerd={'No\nproblem'}
                artPlacement="edge"
                subtitle="Pay Mercado Pago QRs in Argentina with your passport."
                art={<QrArgentinaHeroArt />}
                artLabel="The Peanut scanner reading a QR code"
                cta={
                    <StarLpCta href={STAR_LP_HREF.signup} ground="pink">
                        Create an account
                    </StarLpCta>
                }
            />

            <StarLpMarquee between={['pink', 'cream']} words={HERO_SEAM} />

            <Band ground="cream">
                <QrArgentinaRateFold usdArs={usdArs} />
            </Band>

            <StarLpMarquee between={['cream', 'sky']} ground="pink" words={REVIEW_SEAM} />

            <Band ground="sky" id={QR_AR_THEIR_SCREEN_ID}>
                <div className="grid gap-12 md:grid-cols-2 md:items-center">
                    <SectionTitle>
                        On their screen, it&apos;s a normal <span className="xs:whitespace-nowrap">Mercado Pago</span>{' '}
                        payment.
                    </SectionTitle>
                    <QrArgentinaTheirScreen />
                </div>
            </Band>

            <StarLpMarquee between={['sky', 'pink']} words={SCREEN_SEAM} />

            <Band ground="pink">
                {/* one column until lg, so each sentence of the title keeps its own line at md */}
                <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
                    <SectionTitle>
                        <span className="block">Dinner for six.</span> <span className="block">Be the star.</span>
                    </SectionTitle>
                    <QrArgentinaGroupChat usdArs={usdArs} />
                </div>
            </Band>

            <StarLpFaq items={FAQ} />
            <TrustBand text={STAR_LP_TRUST_LINE} />
            <StarLpMarquee between={['black', 'pink']} ground="sky" words={TRUST_SEAM} />
            <QrArgentinaClose />
            <StarLpMarquee between={['pink', 'black']} words={CLOSE_SEAM} />
        </>
    )
}
