import { Band } from '@/components/Marketing/StarLp/Band'
import { DisplayLine } from '@/components/Marketing/StarLp/DisplayLine'
import { KnerdTitle } from '@/components/Marketing/StarLp/KnerdTitle'
import { SectionTitle } from '@/components/Marketing/StarLp/SectionTitle'
import { StarLpCta } from '@/components/Marketing/StarLp/StarLpCta'
import { StarLpFaq } from '@/components/Marketing/StarLp/StarLpFaq'
import { StarLpHero } from '@/components/Marketing/StarLp/StarLpHero'
import { TrustBand } from '@/components/Marketing/StarLp/TrustBand'
import { STAR_LP_HREF } from '@/components/Marketing/StarLp/starLp.consts'
import type { StarLpFaqItem } from '@/components/Marketing/StarLp/starLp.types'
import { QrBrazilClose } from './QrBrazilClose'
import { QrBrazilHeroScene } from './QrBrazilHeroScene'
import { QrBrazilPaidPhones } from './QrBrazilPaidPhones'
import { QrBrazilWaysIn } from './QrBrazilWaysIn'

/* Claims: product/spending.md (Pix QR, keys, copia e cola; Pix Automático
   rejected), kyc.md (passport instead of CPF, pay only), build-brief.md. */
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
    },
]

export function QrBrazilLanding() {
    return (
        <>
            <StarLpHero
                title={
                    <>
                        <DisplayLine>No CPF?</DisplayLine>
                        <KnerdTitle text={'No\nproblem'} size="hero" className="my-4 md:my-6" />
                        <DisplayLine>at the counter.</DisplayLine>
                    </>
                }
                subtitle="Pay with Pix in Brazil from your dollars."
                art={<QrBrazilHeroScene />}
                cta={
                    <StarLpCta href={STAR_LP_HREF.signup} ground="pink">
                        Create an account
                    </StarLpCta>
                }
            />
            <Band ground="sky">
                <div className="grid gap-12 md:grid-cols-2 md:items-center">
                    <div className="grid gap-8">
                        <SectionTitle>To the shop, it&apos;s just Pix.</SectionTitle>
                        <div className="w-full max-w-[420px]">
                            <QrBrazilWaysIn />
                        </div>
                    </div>
                    <QrBrazilPaidPhones />
                </div>
            </Band>
            <TrustBand text={'No one can block you\nor take your funds.'} />
            <StarLpFaq items={FAQ} />
            <QrBrazilClose />
        </>
    )
}
