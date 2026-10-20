import BorderCloud from '@/assets/illustrations/border-cloud.svg'
import Exclamations from '@/assets/illustrations/exclamations.svg'
import GotItHand from '@/assets/illustrations/got-it-hand.svg'
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
import { RequestLinksLinkCard } from './RequestLinksLinkCard'
import { RequestLinksMail } from './RequestLinksMail'
import { RequestLinksOldReply } from './RequestLinksOldReply'
import { RequestLinksPaidTick } from './RequestLinksPaidTick'
import { RequestLinksPayScreen } from './RequestLinksPayScreen'
import { RequestLinksReceipt } from './RequestLinksReceipt'
import { RequestLinksTimeline } from './RequestLinksTimeline'
import { REQUEST_LINKS_STORY } from './requestLinks.consts'

const CTA_LABEL = 'Create an account'

/** request-links.md: one-side KYC, any channel, Peanut instant, exchange or wallet in minutes. */
const FAQ: StarLpFaqItem[] = [
    {
        id: 'client-account',
        question: 'Does my client need an account?',
        answer: 'Not if you’re verified. They pay from an exchange or wallet, with no sign-up.',
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

const twoColumns = 'grid gap-10 md:grid-cols-2 md:items-center md:gap-12'

export function RequestLinksLanding() {
    return (
        <>
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

            <Band ground="cream">
                <div className={twoColumns}>
                    <SectionTitle>
                        The old reply took a{' '}
                        <span className="whitespace-nowrap">
                            week.
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={Exclamations.src}
                                width={Exclamations.width}
                                height={Exclamations.height}
                                alt=""
                                aria-hidden
                                className="ml-2 inline-block w-7 -translate-y-4 rotate-12 align-top md:-mb-4 md:w-10 md:-translate-y-1"
                            />
                        </span>
                    </SectionTitle>
                    <div className="w-full max-w-[520px] md:justify-self-end">
                        <RequestLinksOldReply />
                    </div>
                </div>
            </Band>

            <Band ground="sky">
                <div className={twoColumns}>
                    <SectionTitle>This is what your client sees.</SectionTitle>
                    <PopIn tilt={-1}>
                        <RequestLinksPayScreen />
                    </PopIn>
                </div>
            </Band>

            <Band ground="white">
                <div className={twoColumns}>
                    <SectionTitle>Follow one payment.</SectionTitle>
                    <RequestLinksTimeline />
                </div>
            </Band>

            <Band ground="yellow">
                <div className={twoColumns}>
                    <SectionTitle>The small print, in large type.</SectionTitle>
                    <div className="relative">
                        <PopIn tilt={-1}>
                            <RequestLinksReceipt />
                        </PopIn>
                        <PopIn
                            delay={0.3}
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

            <TrustBand text={'No one can block you\nor take your funds.'} />
            <StarLpFaq items={FAQ} />

            {/*
              The closing fold keeps the approved copy and its chat thread, so it is composed
              from CloseFold's parts in CloseFold's order: CloseFold has no slot for the thread.
            */}
            <Band ground="pink" align="center" className="overflow-visible">
                {/* Straddles the cream/pink seam at every width, inside the 24 px gutter. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={BorderCloud.src}
                    width={BorderCloud.width}
                    height={BorderCloud.height}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    aria-hidden
                    className="pointer-events-none absolute -top-22 left-0 w-28 md:-top-34 md:left-[8%] md:w-44"
                />
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
        </>
    )
}
