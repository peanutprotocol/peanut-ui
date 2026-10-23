import HandPeace from '@/assets/illustrations/hand-peace.svg'
import { CloudsCss } from '@/components/LandingPage/CloudsCss'
import { Band } from '@/components/Marketing/StarLp/Band'
import { CloseFold } from '@/components/Marketing/StarLp/CloseFold'
import { PersonaFold } from '@/components/Marketing/StarLp/PersonaFold'
import { PopIn } from '@/components/Marketing/StarLp/PopIn'
import { SectionTitle } from '@/components/Marketing/StarLp/SectionTitle'
import { StarLpCta } from '@/components/Marketing/StarLp/StarLpCta'
import { StarLpFaq } from '@/components/Marketing/StarLp/StarLpFaq'
import { StarLpHero } from '@/components/Marketing/StarLp/StarLpHero'
import { StarLpMarquee } from '@/components/Marketing/StarLp/StarLpMarquee'
import { TrustBand } from '@/components/Marketing/StarLp/TrustBand'
import { Wiggle } from '@/components/Marketing/StarLp/Wiggle'
import {
    STAR_LP_HREF,
    STAR_LP_SKY_CLOUDS,
    STAR_LP_SKY_CLOUDS_CLASS,
    STAR_LP_TRUST_LINE,
} from '@/components/Marketing/StarLp/starLp.consts'
import type { StarLpFaqItem } from '@/components/Marketing/StarLp/starLp.types'
import { fetchEurUsdRate } from '@/components/Marketing/StarLp/starLpFx'
import { UsEuAccountPair } from './UsEuAccountPair'
import { UsEuRequestStrips } from './UsEuRequestStrips'
import { UsEuTimeline } from './UsEuTimeline'
import { US_EU_PERSONA_CARDS, US_EU_REQUEST_HREF } from './usEuAccounts.consts'

// Payer rules, timing and cost from product/quick-ref.md and pricing.md
// (deposit-account-open, bank-deposits-sepa, bank-deposits-ach).
const FAQ: StarLpFaqItem[] = [
    {
        id: 'who-can-pay',
        question: 'Who can pay me?',
        answer: 'Employers and business clients. US dollars: your own account or a business, any amount; another person under $4,000 per payment. If you live in Texas, only your own account. Euros: your own account or a business.',
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

// Marquee words: the hero, FAQ and pricing.md (no Peanut fee to open or keep),
// request-links.md (instant from a Peanut balance, no expiry). Plain words only.
const HERO_SEAM: string[] = ['US account details', 'Euro IBAN', 'ACH', 'SEPA', 'Dollars arrive as dollars']
// The core ICP in product/icps.md, in its own words.
const PERSONA_SEAM: string[] = ['Freelancers', 'Remote workers', 'Paid from the US', 'Paid from Europe']
const HOW_SEAM: string[] = ['Employers', 'Business clients', 'Salary', 'Invoices']
const LINK_SEAM: string[] = ['One link', 'Instant from a Peanut balance', 'Share in any chat', 'Never expires']
const FAQ_SEAM: string[] = ['No fee to open', 'No fee to keep', 'Withdraw to your bank', 'Passkey sign-in']
const CLOSE_SEAM: string[] = ['USD', 'EUR', 'Verify in minutes', 'Self-custodial']

const FOOTNOTE = 'Peanut is not a bank. Accounts may not be available where you live.'

/**
 * /us-europe-accounts: get paid from the US and Europe into Peanut's USD and EUR accounts.
 * Folds: pink, yellow, cream, sky, black, cream, pink, footer. Every seam with a
 * coloured side carries a marquee; the black/cream seam after the trust line does not.
 * Two-column folds alternate sides: How it works has its art right, Send a link left.
 */
export async function UsEuAccountsLanding() {
    // Live EUR→USD for the money-in push; null leaves the push without a dollar figure.
    const eurUsd = await fetchEurUsdRate()
    return (
        <>
            <StarLpHero
                lead="Get paid from"
                knerd={'US\nand Europe'}
                knerdJoin="and"
                // The audience first (product/icps.md: lead with the source of earnings, then the labels).
                subtitle="For freelancers and remote workers paid from the US or Europe."
                art={<UsEuAccountPair />}
                cta={
                    <StarLpCta
                        qrPlacement="hero"
                        href={STAR_LP_HREF.accountsGuest}
                        signedInHref={STAR_LP_HREF.accountsSignedIn}
                        ground="pink"
                    >
                        Open your accounts
                    </StarLpCta>
                }
            />

            <StarLpMarquee between={['pink', 'yellow']} words={HERO_SEAM} />

            <PersonaFold cards={US_EU_PERSONA_CARDS} />

            <StarLpMarquee between={['yellow', 'cream']} words={PERSONA_SEAM} />

            <Band ground="cream">
                <div className="grid gap-10 md:grid-cols-2 md:items-center md:gap-12">
                    <SectionTitle>How it works</SectionTitle>
                    <UsEuTimeline eurUsd={eurUsd} />
                </div>
            </Band>

            <StarLpMarquee between={['cream', 'sky']} ground="pink" words={HOW_SEAM} />

            <Band ground="sky">
                <CloudsCss clouds={[...STAR_LP_SKY_CLOUDS]} className={STAR_LP_SKY_CLOUDS_CLASS} />
                {/* Mirrors How it works: the strips take the first column from md, the title the second;
                    stacked, the title still comes first. */}
                <div className="grid gap-10 md:grid-cols-2 md:items-center md:gap-12">
                    <div className="flex flex-col items-start gap-8 md:order-last">
                        <SectionTitle>Paid by someone on Peanut? Send a link.</SectionTitle>
                        <StarLpCta
                            qrPlacement="request-fold"
                            href={US_EU_REQUEST_HREF.guest}
                            signedInHref={US_EU_REQUEST_HREF.signedIn}
                            ground="sky"
                        >
                            Get your link
                        </StarLpCta>
                    </div>
                    <UsEuRequestStrips />
                </div>
            </Band>

            <StarLpMarquee between={['sky', 'black']} words={LINK_SEAM} />

            <TrustBand text={STAR_LP_TRUST_LINE} />

            <StarLpFaq items={FAQ} footnote={FOOTNOTE} />

            <StarLpMarquee between={['cream', 'pink']} ground="sky" words={FAQ_SEAM} />

            <CloseFold
                title={'Open\nyours now'}
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
                        <StarLpCta
                            qrPlacement="close"
                            href={STAR_LP_HREF.accountsGuest}
                            signedInHref={STAR_LP_HREF.accountsSignedIn}
                            ground="pink"
                        >
                            Open your accounts
                        </StarLpCta>
                    </div>
                }
            />

            <StarLpMarquee between={['pink', 'black']} words={CLOSE_SEAM} />
        </>
    )
}
