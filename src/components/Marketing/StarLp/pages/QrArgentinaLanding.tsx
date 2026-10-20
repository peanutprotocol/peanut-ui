import { Band } from '@/components/Marketing/StarLp/Band'
import { DisplayLine } from '@/components/Marketing/StarLp/DisplayLine'
import { KnerdTitle } from '@/components/Marketing/StarLp/KnerdTitle'
import { PopIn } from '@/components/Marketing/StarLp/PopIn'
import { SectionTitle } from '@/components/Marketing/StarLp/SectionTitle'
import { StarLpCta } from '@/components/Marketing/StarLp/StarLpCta'
import { StarLpFaq } from '@/components/Marketing/StarLp/StarLpFaq'
import { StarLpHero } from '@/components/Marketing/StarLp/StarLpHero'
import { TrustBand } from '@/components/Marketing/StarLp/TrustBand'
import { STAR_LP_HREF } from '@/components/Marketing/StarLp/starLp.consts'
import type { StarLpFaqItem } from '@/components/Marketing/StarLp/starLp.types'
import { fetchUsdArsRate } from '@/components/Marketing/StarLp/starLpFx'
import { QrArgentinaClose } from './QrArgentinaClose'
import { QrArgentinaGroupChat } from './QrArgentinaGroupChat'
import { QrArgentinaHeroArt } from './QrArgentinaHeroArt'
import { QrArgentinaMotionStyle } from './QrArgentinaMotionStyle'
import { QrArgentinaReview } from './QrArgentinaReview'
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

/**
 * /qr-payments/argentina: pay Mercado Pago QRs with a passport (mock r4-qr-argentina-a4, folds 0–5).
 * No two coloured bands touch (pink, cream, sky, black, cream, black, pink), so no marquee.
 */
export async function QrArgentinaLanding() {
    // Live Manteca USD→ARS, the rate the QR payment executes at; null hides the dollar line.
    const usdArs = await fetchUsdArsRate()
    return (
        <>
            <QrArgentinaMotionStyle />
            <StarLpHero
                title={
                    <>
                        <DisplayLine>No DNI?</DisplayLine>
                        <KnerdTitle text={'No\nproblem'} size="hero" className="mt-6 mb-4 md:mt-10 md:mb-8" />
                        <DisplayLine>at the till.</DisplayLine>
                    </>
                }
                subtitle="Pay Mercado Pago QRs in Argentina with your passport."
                art={<QrArgentinaHeroArt />}
                artLabel="The Peanut scanner reading a QR code"
                cta={
                    <StarLpCta href={STAR_LP_HREF.signup} ground="pink">
                        Create an account
                    </StarLpCta>
                }
            />

            <Band ground="cream">
                <div className="grid gap-12 md:grid-cols-2 md:items-center">
                    <SectionTitle>See the pesos before you pay.</SectionTitle>
                    <PopIn tilt={-1}>
                        <QrArgentinaReview usdArs={usdArs} />
                    </PopIn>
                </div>
            </Band>

            <Band ground="sky" id={QR_AR_THEIR_SCREEN_ID}>
                <div className="grid gap-12 md:grid-cols-2 md:items-center">
                    <SectionTitle>
                        On their screen, it&apos;s a normal{' '}
                        <span className="xs:whitespace-nowrap md:whitespace-normal xl:whitespace-nowrap">
                            Mercado Pago
                        </span>{' '}
                        payment.
                    </SectionTitle>
                    <QrArgentinaTheirScreen />
                </div>
            </Band>

            <Band ground="black">
                <div className="grid gap-12 md:grid-cols-2 md:items-center">
                    <SectionTitle>Dinner for six. One request link.</SectionTitle>
                    <QrArgentinaGroupChat />
                </div>
            </Band>

            <StarLpFaq items={FAQ} />
            <TrustBand text={'No one can block you\nor take your funds.'} />
            <QrArgentinaClose />
        </>
    )
}
