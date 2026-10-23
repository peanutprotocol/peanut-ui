import Link from 'next/link'
import { Band } from '@/components/Marketing/StarLp/Band'
import { SectionTitle } from '@/components/Marketing/StarLp/SectionTitle'
import { StarLpCta } from '@/components/Marketing/StarLp/StarLpCta'
import { StarLpFaq } from '@/components/Marketing/StarLp/StarLpFaq'
import { StarLpHero } from '@/components/Marketing/StarLp/StarLpHero'
import { StarLpMarquee } from '@/components/Marketing/StarLp/StarLpMarquee'
import { fetchUsdBrlRate } from '@/components/Marketing/StarLp/starLpFx'
import { TrustBand } from '@/components/Marketing/StarLp/TrustBand'
import { STAR_LP_HREF, STAR_LP_TRUST_LINE } from '@/components/Marketing/StarLp/starLp.consts'
import { EN_LANDING_CONTENT_HREFS } from '@/components/LandingPage/landingContentHrefs'
import type { StarLpFaqItem } from '@/components/Marketing/StarLp/starLp.types'
import { QrBrazilClose } from './QrBrazilClose'
import { QrBrazilHeroScene } from './QrBrazilHeroScene'
import { QrBrazilMotionStyle } from './QrBrazilMotionStyle'
import { QrBrazilPayStory } from './QrBrazilPayStory'
import { QrBrazilWaysIn } from './QrBrazilWaysIn'

/* Claims: product/spending.md (Pix QR, keys, copia e cola; Pix Automático
   rejected; "Sending Funds to a Person": any Pix key pays a person, not only a
   shop), kyc.md (passport instead of CPF, pay only), build-brief.md. */
const FAQ: StarLpFaqItem[] = [
    {
        id: 'cpf',
        question: 'Do I need a CPF or a Brazilian bank account?',
        answer: 'No, not to pay. Verify once with your passport and a selfie, add dollars, then pay.',
    },
    {
        id: 'what',
        question: 'What can I pay?',
        answer: "Pix QR codes, Pix keys (CPF, CNPJ, phone, email or random key) and Pix copia e cola. Pix Automático isn't supported.",
    },
    {
        id: 'limit',
        question: 'Is there a limit?',
        answer: 'Up to USD 2,000 per payment. Your monthly limit depends on where you live.',
    },
    {
        id: 'cost',
        question: 'What does it cost?',
        answer: 'No Peanut fee. You pay at the rate shown before you confirm.',
        answerContent: (
            <p>
                <Link href={EN_LANDING_CONTENT_HREFS.pricing} className="text-foreground-primary underline">
                    No Peanut fee
                </Link>
                . You pay at the rate shown before you confirm.
            </p>
        ),
    },
]

/* The pink hero meets the sky band: product words from spending.md, kyc.md
   and pricing.md. All plain words, so the strip stays aria-hidden and adds no
   moving links or tab stops. Never "Pix Automático", which Peanut does not support. */
const HERO_SEAM: string[] = [
    'Pix QR',
    'Pix key',
    'Copia e cola',
    'Pay from dollars',
    'Up to USD 2,000 per payment',
    'No Peanut fee',
]

const STORY_SEAM: string[] = ['Scan', 'See the reais', 'Confirm', 'Done']
// kyc.md: passport instead of CPF, pay only.
const FAQ_SEAM: string[] = ['Passport and a selfie', 'Verify once', 'No Brazilian bank', 'No CPF']
const CLOSE_SEAM: string[] = ['Self-custodial', 'Passkey', 'Dollars', 'Rate before you confirm']

export async function QrBrazilLanding() {
    const usdBrl = await fetchUsdBrlRate()
    return (
        <>
            <QrBrazilMotionStyle />
            <StarLpHero
                lead="No CPF?"
                knerd={'No\nproblem'}
                titleTail="at the counter."
                artPlacement="edge"
                subtitle="Pay shops and people with Pix in Brazil, from your dollars."
                art={<QrBrazilHeroScene />}
                cta={
                    <StarLpCta href={STAR_LP_HREF.signup} ground="pink">
                        Create an account
                    </StarLpCta>
                }
            />
            <StarLpMarquee between={['pink', 'sky']} words={HERO_SEAM} />
            <Band ground="sky">
                {/* one column until lg: at md the phone pair would shrink until its rows are unreadable */}
                <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
                    <div className="grid gap-8">
                        <SectionTitle>Shops or people, it&apos;s just Pix.</SectionTitle>
                        <div className="w-full max-w-[420px] lg:max-w-[520px]">
                            <QrBrazilWaysIn />
                        </div>
                    </div>
                    <QrBrazilPayStory usdBrl={usdBrl} />
                </div>
            </Band>
            <StarLpMarquee between={['sky', 'black']} ground="pink" words={STORY_SEAM} />
            <TrustBand text={STAR_LP_TRUST_LINE} />
            <StarLpFaq items={FAQ} />
            <StarLpMarquee between={['cream', 'pink']} words={FAQ_SEAM} />
            <QrBrazilClose />
            <StarLpMarquee between={['pink', 'black']} ground="sky" words={CLOSE_SEAM} />
        </>
    )
}
