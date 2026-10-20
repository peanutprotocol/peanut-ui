import HandPeace from '@/assets/illustrations/hand-peace.svg'
import { Band } from '@/components/Marketing/StarLp/Band'
import { CloseFold } from '@/components/Marketing/StarLp/CloseFold'
import { DisplayLine } from '@/components/Marketing/StarLp/DisplayLine'
import { KnerdTitle } from '@/components/Marketing/StarLp/KnerdTitle'
import { PopIn } from '@/components/Marketing/StarLp/PopIn'
import { SectionTitle } from '@/components/Marketing/StarLp/SectionTitle'
import { StarLpCta } from '@/components/Marketing/StarLp/StarLpCta'
import { StarLpFaq } from '@/components/Marketing/StarLp/StarLpFaq'
import { StarLpHero } from '@/components/Marketing/StarLp/StarLpHero'
import { TrustBand } from '@/components/Marketing/StarLp/TrustBand'
import { Wiggle } from '@/components/Marketing/StarLp/Wiggle'
import { STAR_LP_HREF } from '@/components/Marketing/StarLp/starLp.consts'
import type { StarLpFaqItem } from '@/components/Marketing/StarLp/starLp.types'
import { UsEuAccountPair } from './UsEuAccountPair'
import { UsEuRequestChat } from './UsEuRequestChat'
import { UsEuTimeline } from './UsEuTimeline'

// Payer rules, timing and cost from product/quick-ref.md and pricing.md
// (deposit-account-open, bank-deposits-sepa, bank-deposits-ach).
const FAQ: StarLpFaqItem[] = [
    {
        id: 'who-can-pay',
        question: 'Who can pay me?',
        answer: 'Employers and business clients. US dollars: a business can send any amount, another person under $4,000 per payment. If you live in Texas, only your own account can send you dollars. Euros: your own account or a business.',
    },
    {
        id: 'how-long',
        question: 'How long does it take?',
        answer: 'Euros usually arrive the same business day, at most two. US dollars by ACH take 1 to 3 business days.',
    },
    {
        id: 'cost',
        question: 'What does it cost?',
        answer: 'No Peanut fee to open or keep your accounts, and none on what arrives. Dollars arrive as dollars. Euros convert to dollars at the rate shown in the app. The conversion cost is in that rate.',
    },
    {
        id: 'local-bank',
        question: 'Can I move it to my local bank?',
        answer: 'Yes, to your own bank account in the US, Europe, Mexico or Colombia. Argentina and Brazil: residents with a CUIT or CPF.',
    },
]

const FOOTNOTE = 'Peanut is not a bank. Accounts may not be available where you live.'

/** Hero knerd scale from md: one step under `hero` so 'US and EUROPE' stays on one line. */
const HERO_KNERD_FIT = 'md:text-heading lg:text-headingMedium'

/** /us-europe-accounts: get paid from the US and Europe into Peanut's USD and EUR accounts. */
export function UsEuAccountsLanding() {
    return (
        <>
            <StarLpHero
                title={
                    <>
                        <DisplayLine>Get paid from</DisplayLine>
                        {/* One line at every width: the hero scale steps down from md so the lockup fits the 560px copy column. */}
                        <span className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 md:flex-nowrap md:justify-start">
                            <KnerdTitle text="US" size="hero" className={HERO_KNERD_FIT} />
                            <DisplayLine className="inline-block text-heading-s lowercase md:text-heading-m">
                                and
                            </DisplayLine>
                            <KnerdTitle text="Europe" size="hero" className={HERO_KNERD_FIT} />
                        </span>
                    </>
                }
                subtitle="US account details and a euro IBAN."
                art={<UsEuAccountPair />}
                cta={
                    <StarLpCta href={STAR_LP_HREF.signup} ground="pink">
                        Open your accounts
                    </StarLpCta>
                }
            />

            <Band ground="cream">
                <div className="grid gap-10 md:grid-cols-2 md:items-center md:gap-12">
                    <SectionTitle>How it works</SectionTitle>
                    <UsEuTimeline />
                </div>
            </Band>

            <Band ground="sky">
                <div className="grid gap-10 md:grid-cols-2 md:items-center md:gap-12">
                    <SectionTitle>Paid by someone on Peanut? Send a link.</SectionTitle>
                    <UsEuRequestChat />
                </div>
            </Band>

            <TrustBand text={'No one can block you\nor take your funds.'} />

            <StarLpFaq items={FAQ} footnote={FOOTNOTE} />

            <CloseFold
                title={'Open yours\nnow'}
                line="Verifying takes a few minutes for most people."
                // The glove sits beside the CTA (as in the mock), so no free-floating decoration.
                // Below xs it stacks above the CTA so the large button keeps a one-line label at 320.
                decoration={<></>}
                cta={
                    <div className="flex flex-col items-center gap-3 xs:flex-row md:gap-4">
                        <PopIn tilt={-10} className="pointer-events-none w-12 shrink-0 md:w-16">
                            <Wiggle kind="wobble">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={HandPeace.src}
                                    width={HandPeace.width}
                                    height={HandPeace.height}
                                    alt=""
                                    aria-hidden
                                    loading="lazy"
                                />
                            </Wiggle>
                        </PopIn>
                        <StarLpCta href={STAR_LP_HREF.signup} ground="pink">
                            Open your accounts
                        </StarLpCta>
                    </div>
                }
            />
        </>
    )
}
