import Sparkle from '@/assets/illustrations/sparkle.svg'
import { Band } from '@/components/Marketing/StarLp/Band'
import { DisplayLine } from '@/components/Marketing/StarLp/DisplayLine'
import { KnerdTitle } from '@/components/Marketing/StarLp/KnerdTitle'
import { SectionTitle } from '@/components/Marketing/StarLp/SectionTitle'
import { StarLpCta } from '@/components/Marketing/StarLp/StarLpCta'
import { StarLpFaq } from '@/components/Marketing/StarLp/StarLpFaq'
import { StarLpHero } from '@/components/Marketing/StarLp/StarLpHero'
import { Wiggle } from '@/components/Marketing/StarLp/Wiggle'
import { STAR_LP_HREF } from '@/components/Marketing/StarLp/starLp.consts'
import type { StarLpFaqItem } from '@/components/Marketing/StarLp/starLp.types'
import { SelfCustodyAppPair } from './SelfCustodyAppPair'
import { SelfCustodyClose } from './SelfCustodyClose'
import { SelfCustodyCompareTable } from './SelfCustodyCompareTable'
import { SelfCustodyFactTiles } from './SelfCustodyFactTiles'
import { SelfCustodySendScreen } from './SelfCustodySendScreen'

// security.md: never extend "can't freeze" to the card, so the card is named
// as the exception wherever custody is answered.
const FAQ: StarLpFaqItem[] = [
    {
        id: 'freeze',
        question: 'Can Peanut freeze or move my money?',
        answer: 'No. Your balance sits in your own account, not with us, and sending from it needs your passkey. The Peanut Card works differently.',
    },
    {
        id: 'lost-phone',
        question: 'What if I lose my phone?',
        answer: "Your passkey syncs with your Apple or Google account. If it can't be recovered, no one can access the account, including Peanut.",
    },
    {
        id: 'shutdown',
        question: 'What if Peanut shuts down?',
        answer: 'Your account lives onchain, so you can still reach it with another compatible wallet.',
    },
    {
        id: 'scope',
        question: 'Does this cover bank transfers and the card?',
        answer: 'It covers your balance. Bank transfers in and out go through licensed partners, who run their own checks. The Peanut Card works differently: up to your card limit sits in a separate card account managed by our card partner.',
    },
]

export function SelfCustodyLanding() {
    return (
        <>
            <StarLpHero
                title={
                    <>
                        <DisplayLine>Your money.</DisplayLine>
                        <KnerdTitle
                            text="Only you"
                            size="hero"
                            className="mt-6 mb-4 md:mt-10 md:mb-8 md:text-heading lg:text-headingMedium xl:text-headingLarge"
                        />
                        <DisplayLine>can send it.</DisplayLine>
                    </>
                }
                subtitle="Your balance sits in your own account. Every send needs your passkey."
                art={<SelfCustodySendScreen />}
                cta={
                    <StarLpCta href={STAR_LP_HREF.signup} ground="pink">
                        Create an account
                    </StarLpCta>
                }
            />

            <Band ground="yellow">
                <Wiggle kind="wobble" className="pointer-events-none absolute -top-6 right-0 w-11 md:-top-2 md:w-14">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={Sparkle.src} width={Sparkle.width} height={Sparkle.height} alt="" aria-hidden />
                </Wiggle>
                <SectionTitle>
                    Four facts,
                    <br />
                    no adjectives.
                </SectionTitle>
                <div className="mt-10 md:mt-12">
                    <SelfCustodyFactTiles />
                </div>
            </Band>

            <Band ground="sky">
                <SectionTitle>Most apps hold your money. Peanut doesn&apos;t.</SectionTitle>
                <div className="mt-10 grid gap-10 md:mt-12 md:grid-cols-2 md:items-center md:gap-12">
                    <SelfCustodyAppPair />
                    <div className="mx-auto w-full max-w-md">
                        <SelfCustodyCompareTable />
                    </div>
                </div>
            </Band>

            <StarLpFaq items={FAQ} />

            <SelfCustodyClose />
        </>
    )
}
