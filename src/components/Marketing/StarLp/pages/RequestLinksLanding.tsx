import GotItHand from '@/assets/illustrations/got-it-hand.svg'
import { CloudsCss } from '@/components/LandingPage/CloudsCss'
import { Band } from '@/components/Marketing/StarLp/Band'
import { DisplayLine } from '@/components/Marketing/StarLp/DisplayLine'
import { KnerdTitle } from '@/components/Marketing/StarLp/KnerdTitle'
import { PopIn } from '@/components/Marketing/StarLp/PopIn'
import { SectionTitle } from '@/components/Marketing/StarLp/SectionTitle'
import { StarLpCta } from '@/components/Marketing/StarLp/StarLpCta'
import { StarLpFaq } from '@/components/Marketing/StarLp/StarLpFaq'
import { StarLpHero } from '@/components/Marketing/StarLp/StarLpHero'
import { StarLpMarquee } from '@/components/Marketing/StarLp/StarLpMarquee'
import { TrustBand } from '@/components/Marketing/StarLp/TrustBand'
import {
    STAR_LP_HREF,
    STAR_LP_SKY_CLOUDS,
    STAR_LP_SKY_CLOUDS_CLASS,
    STAR_LP_TRUST_LINE,
} from '@/components/Marketing/StarLp/starLp.consts'
import type { StarLpFaqItem } from '@/components/Marketing/StarLp/starLp.types'
import { RequestLinksExclamations } from './RequestLinksExclamations'
import { RequestLinksLinkCard } from './RequestLinksLinkCard'
import { RequestLinksMail } from './RequestLinksMail'
import { RequestLinksMotionStyle } from './RequestLinksMotionStyle'
import { RequestLinksOldReply } from './RequestLinksOldReply'
import { RequestLinksPaidTick } from './RequestLinksPaidTick'
import { RequestLinksPayScreen } from './RequestLinksPayScreen'
import { RequestLinksReceiptPrint } from './RequestLinksReceiptPrint'
import { RequestLinksTimeline } from './RequestLinksTimeline'
import { REQUEST_LINKS_CLIENT_SEES_ID, REQUEST_LINKS_STORY } from './requestLinks.consts'

const CTA_LABEL = 'Create an account'

/**
 * request-links.md: one-side KYC, any channel, Peanut instant, exchange or wallet in minutes.
 * Mercado Pago and Pix cannot fund a request (excluded_contribution_methods), so the copy
 * never offers them. Today's pay page still draws a Mercado Pago row; the page's capture
 * has it cut out (RequestLinksPayScreen).
 */
const FAQ: StarLpFaqItem[] = [
    {
        id: 'client-account',
        question: 'Does my client need an account?',
        answer: 'Not if you’re verified. They can pay from an exchange or wallet, with no sign-up.',
    },
    {
        id: 'invoice',
        question: 'Can I put the link in my invoice?',
        answer: 'Yes. Share it anywhere: an invoice, an email, a chat or a printed QR code.',
    },
    {
        id: 'speed',
        question: 'How long does it take?',
        answer: 'From a Peanut balance, it’s instant. From an exchange or wallet, it takes minutes.',
    },
]

// Marquee words: request-links.md (channels, contribution methods, speed, fees,
// no expiry, use cases). Never Pix or Mercado Pago: they cannot fund a request.
const HERO_SEAM: string[] = ['One link', 'Invoices', 'Emails', 'Chats', 'Printed QR']
const OLD_REPLY_SEAM: string[] = ['Exchange', 'Wallet', 'Bank transfer', 'Peanut balance']
const CLIENT_SEAM: string[] = ['Instant from a Peanut balance', 'Minutes from a wallet', 'No escrow', 'Any amount']
const TIMELINE_SEAM: string[] = ['Free to create', 'Free to pay', 'Never expires', 'Many can chip in']
const SMALL_PRINT_SEAM: string[] = ['Tips', 'Group gifts', 'Donations', 'Split bills']
const FAQ_SEAM: string[] = ['Verify once', 'Passkey sign-in', 'Self-custodial', 'Your balance']
const CLOSE_SEAM: string[] = ['Freelance work', 'Client payments', 'Shared costs', 'Paid in dollars']

const twoColumns = 'grid gap-10 md:grid-cols-2 md:items-center md:gap-12'

export function RequestLinksLanding() {
    return (
        <>
            <RequestLinksMotionStyle />
            <StarLpHero
                lead="“How do I pay you?”"
                knerd={'Send\nthis.'}
                // no-break spaces: a wrapped line breaks only between the sentences
                subtitle={'One link. They pay. It\u00a0lands\u00a0in\u00a0your\u00a0balance.'}
                art={<RequestLinksMail />}
                // the mail's title bar stays readable under the wide Knerd
                artTuck="rim"
                cta={
                    <StarLpCta href={STAR_LP_HREF.signup} ground="pink">
                        {CTA_LABEL}
                    </StarLpCta>
                }
            />

            <StarLpMarquee between={['pink', 'cream']} words={HERO_SEAM} />

            <Band ground="cream">
                {/* One column until lg, like the small print: at md the half-width thread squeezed
                    "Payment received" onto two lines. */}
                <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-12">
                    <SectionTitle>
                        The old reply took a{' '}
                        <span className="whitespace-nowrap">
                            week.
                            <RequestLinksExclamations />
                        </span>
                    </SectionTitle>
                    <div className="w-full max-w-[520px] lg:[zoom:1.15] lg:justify-self-end">
                        <RequestLinksOldReply />
                    </div>
                </div>
            </Band>

            <StarLpMarquee between={['cream', 'sky']} ground="pink" words={OLD_REPLY_SEAM} />

            {/* Link cards scroll here: "what your client sees" is where a request link opens. */}
            <Band ground="sky" id={REQUEST_LINKS_CLIENT_SEES_ID} className="scroll-mt-16">
                {/* In the band's paddings, as on /us-europe-accounts, so no cloud peeks from behind the phone. */}
                <CloudsCss clouds={[...STAR_LP_SKY_CLOUDS]} className={STAR_LP_SKY_CLOUDS_CLASS} />
                <div className={twoColumns}>
                    <SectionTitle>This is what your client sees.</SectionTitle>
                    {/* lg scales the art (zoom keeps its proportions) so it holds its column beside the title */}
                    <PopIn tilt={-1} className="lg:[zoom:1.25]">
                        <RequestLinksPayScreen />
                    </PopIn>
                </div>
            </Band>

            <StarLpMarquee between={['sky', 'white']} words={CLIENT_SEAM} />

            <Band ground="white">
                <div className={twoColumns}>
                    <SectionTitle>Follow one payment.</SectionTitle>
                    <RequestLinksTimeline />
                </div>
            </Band>

            <StarLpMarquee between={['white', 'yellow']} words={TIMELINE_SEAM} />

            <Band ground="yellow">
                {/* one column until lg: at md a half column wraps the receipt's labels */}
                <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-12">
                    <SectionTitle>The small print, in large type.</SectionTitle>
                    {/* stacked, the box hugs the receipt so the hand keeps its place at the receipt's corner */}
                    <div className="relative mx-auto w-full max-w-[536px] lg:max-w-none">
                        <RequestLinksReceiptPrint />
                        <PopIn
                            delay={1.1}
                            tilt={-15}
                            className="pointer-events-none absolute -right-4 -bottom-6 w-16 md:right-8 md:w-20"
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={GotItHand.src}
                                width={GotItHand.width}
                                height={GotItHand.height}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                aria-hidden
                            />
                        </PopIn>
                    </div>
                </div>
            </Band>

            <StarLpMarquee between={['yellow', 'black']} ground="pink" words={SMALL_PRINT_SEAM} />
            <TrustBand text={STAR_LP_TRUST_LINE} />
            <StarLpFaq items={FAQ} />
            <StarLpMarquee between={['cream', 'pink']} words={FAQ_SEAM} />

            {/*
              The closing fold keeps the approved copy and its chat thread, so it is composed
              from CloseFold's parts in CloseFold's order: CloseFold has no slot for the thread.
            */}
            <Band ground="pink" align="center">
                <h2>
                    <DisplayLine>
                        Next time they ask, <span className="whitespace-nowrap">you&apos;ll have</span>
                    </DisplayLine>
                    <span className="mt-6 block md:mt-10 lg:mt-14">
                        <KnerdTitle text="the link." size="hero" />
                    </span>
                </h2>
                {/* md+ scales the thread as a whole (zoom keeps its proportions) so it holds up beside the Knerd */}
                <div className="mx-auto mt-8 flex max-w-md flex-col gap-3 text-left md:[zoom:1.3]">
                    <PopIn className="w-fit max-w-[80%] self-start">
                        <p className="rounded-card border-2 border-border-default bg-background-default px-3 py-2 text-label-l">
                            Logo looks great! How do I pay you?
                        </p>
                    </PopIn>
                    <PopIn delay={0.15} className="w-[85%] max-w-72 self-end">
                        <RequestLinksLinkCard />
                    </PopIn>
                    <PopIn delay={0.3} className="w-fit self-start">
                        <RequestLinksPaidTick>Payment received · {REQUEST_LINKS_STORY.amount}</RequestLinksPaidTick>
                    </PopIn>
                </div>
                <div className="mx-auto mt-10 w-fit">
                    <StarLpCta href={STAR_LP_HREF.signup} ground="pink">
                        {CTA_LABEL}
                    </StarLpCta>
                </div>
            </Band>

            <StarLpMarquee between={['pink', 'black']} ground="sky" words={CLOSE_SEAM} />
        </>
    )
}
