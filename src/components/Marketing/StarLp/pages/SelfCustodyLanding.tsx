import Link from 'next/link'
import Sparkle from '@/assets/illustrations/sparkle.svg'
import { Band } from '@/components/Marketing/StarLp/Band'
import { DisplayLine } from '@/components/Marketing/StarLp/DisplayLine'
import { KnerdTitle } from '@/components/Marketing/StarLp/KnerdTitle'
import { SectionTitle } from '@/components/Marketing/StarLp/SectionTitle'
import { StarLpCta } from '@/components/Marketing/StarLp/StarLpCta'
import { StarLpFaq } from '@/components/Marketing/StarLp/StarLpFaq'
import { StarLpHero } from '@/components/Marketing/StarLp/StarLpHero'
import { StarLpMarquee } from '@/components/Marketing/StarLp/StarLpMarquee'
import { Wiggle } from '@/components/Marketing/StarLp/Wiggle'
import { STAR_LP_HREF } from '@/components/Marketing/StarLp/starLp.consts'
import type { StarLpFaqItem } from '@/components/Marketing/StarLp/starLp.types'
import { EN_LANDING_CONTENT_HREFS } from '@/components/LandingPage/landingContentHrefs'
import type { MarqueeItem } from '@/components/Global/MarqueeWrapper/marquee.types'
import { SelfCustodyAppPair } from './SelfCustodyAppPair'
import { SelfCustodyClose } from './SelfCustodyClose'
import { SelfCustodyCompareTable } from './SelfCustodyCompareTable'
import { SelfCustodySendScreen } from './SelfCustodySendScreen'

// Help articles the answers point to for proof. Plain underlined words, no arrows.
const HELP = {
    custody: EN_LANDING_CONTENT_HREFS.securityCustody,
    recovery: '/en/help/account-recovery',
    cardFunding: '/en/help/card-collateral',
}
const FAQ_LINK = 'text-foreground-primary underline'

// The answer's words with one phrase linked. `answer` stays plain text for the
// FAQPage JSON-LD and is the only copy of the words. Both elements carry keys:
// these server-built answers reach the client FAQsPanel through the questions
// array, and an unkeyed <p> there logs React's "unique key" warning.
function linkedAnswer(id: string, answer: string, phrase: string, href: string) {
    const at = answer.indexOf(phrase)
    if (at < 0) return undefined
    return (
        <p key={id}>
            {[
                answer.slice(0, at),
                <Link key="link" href={href} className={FAQ_LINK}>
                    {phrase}
                </Link>,
                answer.slice(at + phrase.length),
            ]}
        </p>
    )
}

function faqItem(id: string, question: string, answer: string, phrase: string, href: string): StarLpFaqItem {
    return { id, question, answer, answerContent: linkedAnswer(id, answer, phrase, href) }
}

// security.md: never extend "can't freeze" to the card, so the card is named
// as the exception wherever custody is answered.
const FAQ: StarLpFaqItem[] = [
    faqItem(
        'freeze',
        'Can Peanut freeze or move my money?',
        'No. Your balance sits in your own account, not with us, and sending from it needs your passkey. The Peanut Card works differently.',
        'works differently',
        HELP.cardFunding
    ),
    faqItem(
        'lost-phone',
        'What if I lose my phone?',
        "Your passkey syncs with your Apple or Google account. If it can't be recovered, no one can access the account, including Peanut.",
        "can't be recovered",
        HELP.recovery
    ),
    faqItem(
        'shutdown',
        'What if Peanut shuts down?',
        'Your account lives onchain, so you can still reach it with another compatible wallet.',
        'compatible wallet',
        HELP.custody
    ),
    faqItem(
        'scope',
        'Does this cover bank transfers and the card?',
        'It covers your balance. Bank transfers in and out go through licensed partners, who run their own checks. The Peanut Card works differently: up to your card limit sits in a separate card account managed by our card partner.',
        'works differently',
        HELP.cardFunding
    ),
]

// Marquee words: product vocabulary from product/security.md that the folds
// beside them do not already say. No card word anywhere on these strips, and
// no "every send" claim standing alone (security.md: card automation acts
// without a fresh signature). Plain words only: a moving, repeated link is a
// poor tap target and a stack of duplicate tab stops, and the FAQ already links
// the custody article ("compatible wallet").
const HERO_SEAM_WORDS: MarqueeItem[] = [
    'Passkey',
    'No password',
    'Face or fingerprint',
    'No 2FA codes',
    'Self-custodial',
]
const FACTS_SEAM_WORDS: MarqueeItem[] = ['Onchain', 'Smart account', 'Arbitrum', 'Works with other wallets']
// security.md: the key is sealed in the Secure Enclave and never sent to Peanut's servers.
const COMPARE_SEAM_WORDS: MarqueeItem[] = ['Your keys', 'Secure Enclave', 'Never sent to Peanut', 'Audited']
// security.md: passkeys sync through Apple or Google; ERC-4337 account built on ZeroDev.
const FAQ_SEAM_WORDS: MarqueeItem[] = ['Synced with Apple or Google', 'No custodian', 'ERC-4337', 'ZeroDev']
const CLOSE_SEAM_WORDS: MarqueeItem[] = ['Hold dollars', 'Send', 'Request', 'Withdraw']

export function SelfCustodyLanding() {
    return (
        <>
            <StarLpHero
                title={
                    <>
                        <DisplayLine size="masthead">Your money.</DisplayLine>
                        <KnerdTitle text={'Only\nyou'} size="masthead" oneLineFrom="md" />
                    </>
                }
                titleTail="can send it."
                subtitle="Your balance sits in your own account. Every send needs your passkey."
                art={<SelfCustodySendScreen />}
                cta={
                    <StarLpCta href={STAR_LP_HREF.signup} ground="pink">
                        Create an account
                    </StarLpCta>
                }
            />

            <StarLpMarquee between={['pink', 'yellow']} words={HERO_SEAM_WORDS} />

            <Band ground="yellow">
                {/* inside the band's top padding, clear of the marquee above */}
                <Wiggle kind="wobble" className="pointer-events-none absolute -top-10 right-0 w-11 md:-top-14 md:w-14">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={Sparkle.src} width={Sparkle.width} height={Sparkle.height} alt="" aria-hidden />
                </Wiggle>
                {/* Konrad's pick (self-custody fold picker, 20 Oct): type only, no cards.
                    "Money" is the hero's word; the card carve-out stays in the FAQ (security.md). */}
                <h2>
                    <DisplayLine>What Peanut can do with your money:</DisplayLine>
                    <KnerdTitle text="Nothing." size="hero" className="mt-6 md:mt-10" />
                </h2>
                <p className="mt-8 text-heading-card text-balance md:mt-10 md:text-heading-s">
                    Can&apos;t send it. Can&apos;t freeze it. Can&apos;t hold it.
                </p>
            </Band>

            <StarLpMarquee between={['yellow', 'sky']} words={FACTS_SEAM_WORDS} />

            <Band ground="sky">
                <SectionTitle>Most apps hold your money. Peanut doesn&apos;t.</SectionTitle>
                <div className="mt-10 grid gap-10 md:mt-12 md:grid-cols-2 md:items-center md:gap-12">
                    <SelfCustodyAppPair />
                    <div className="mx-auto w-full max-w-md">
                        <SelfCustodyCompareTable />
                    </div>
                </div>
            </Band>

            <StarLpMarquee between={['sky', 'cream']} words={COMPARE_SEAM_WORDS} />

            <StarLpFaq items={FAQ} />

            <StarLpMarquee between={['cream', 'pink']} ground="sky" words={FAQ_SEAM_WORDS} />

            <SelfCustodyClose />

            <StarLpMarquee between={['pink', 'black']} words={CLOSE_SEAM_WORDS} />
        </>
    )
}
