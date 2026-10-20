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
import { STAR_LP_HREF } from '@/components/Marketing/StarLp/starLp.consts'
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
 * never offers them, though today's pay page still draws a Mercado Pago row.
 */
const FAQ: StarLpFaqItem[] = [
    {
        id: 'client-account',
        question: 'Does my client need an account?',
        answer: 'Not if you’re verified. They can pay with crypto from an exchange or wallet, with no sign-up. A bank transfer goes through a Peanut account.',
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
const CLIENT_SEAM: string[] = ['Instant from Peanut', 'Minutes from a wallet', 'No escrow', 'Any amount']
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
                title={
                    <>
                        <DisplayLine className="pt-6 md:pt-0">&ldquo;How do I pay you?&rdquo;</DisplayLine>
                        <KnerdTitle text={'Send\nthis.'} size="hero" className="mt-6 md:mt-10 lg:mt-14" />
                    </>
                }
                subtitle="One link. They pay. It lands in your balance."
                art={<RequestLinksMail />}
                cta={
                    <StarLpCta href={STAR_LP_HREF.signup} ground="pink">
                        {CTA_LABEL}
                    </StarLpCta>
                }
            />

            <StarLpMarquee between={['pink', 'cream']} words={HERO_SEAM} />

            <Band ground="cream">
                <div className={twoColumns}>
                    <SectionTitle>
                        The old reply took a{' '}
                        <span className="whitespace-nowrap">
                            week.
                            <RequestLinksExclamations />
                        </span>
                    </SectionTitle>
                    <div className="w-full max-w-[520px] md:justify-self-end">
                        <RequestLinksOldReply />
                    </div>
                </div>
            </Band>

            <StarLpMarquee between={['cream', 'sky']} ground="pink" words={OLD_REPLY_SEAM} />

            {/* Link cards scroll here: "what your client sees" is where a request link opens. */}
            <Band ground="sky" id={REQUEST_LINKS_CLIENT_SEES_ID} className="scroll-mt-16">
                {/* Band clips (overflow-hidden) and its column is relative z-10: the clouds span the band width behind the content. */}
                <CloudsCss
                    clouds={[
                        { top: '18%', width: 160, speed: '40s', direction: 'ltr' },
                        { top: '72%', width: 190, speed: '46s', direction: 'rtl' },
                    ]}
                    className="pointer-events-none left-1/2 -z-10 w-screen -translate-x-1/2"
                />
                <div className={twoColumns}>
                    <SectionTitle>This is what your client sees.</SectionTitle>
                    <PopIn tilt={-1}>
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
                <div className={twoColumns}>
                    <SectionTitle>The small print, in large type.</SectionTitle>
                    <div className="relative">
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
            <TrustBand text={'No one can block you\nor take your funds.'} />
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
                    <KnerdTitle text="the link." size="hero" className="mt-6 md:mt-10 lg:mt-14" />
                </h2>
                <div className="mx-auto mt-8 flex max-w-md flex-col gap-3 text-left">
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
