'use client'

import Image from 'next/image'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/0_Bruddle/Button'
import { Marquee } from '@/components/LandingPage'
import { FAQsPanel } from '@/components/Global/FAQs'
import { useAuth } from '@/context/authContext'
import underMaintenanceConfig from '@/config/underMaintenance.config'
import { CARD_GRADIENT_10 } from '@/assets/cards'

const marqueeMessages = ['IYKYK', 'WORD TRAVELS', 'CLOSED BETA', 'SHHHH', 'PEANUT CLUB']

const stats: Array<{ value: string; label: string }> = [
    { value: '150M+', label: 'Visa-accepting merchants' },
    { value: '1', label: 'balance' },
    { value: '1', label: 'card' },
    { value: '0', label: 'middlemen' },
]

const badges: Array<{ code: string; short: string; classes: string }> = [
    { code: 'OG_2025_10_12', short: 'OG', classes: 'bg-secondary-1 text-n-1' },
    { code: 'DEVCONNECT_BA_2025', short: 'DC', classes: 'bg-primary-1 text-n-1' },
    { code: 'ARBIVERSE_DEVCONNECT_BA_2025', short: 'AV', classes: 'bg-n-1 text-primary-1' },
]

const faqQuestions = [
    {
        id: '0',
        question: "What's the peanut card?",
        answer: 'A non-custodial card. Top up with stablecoins, then use the card for everyday spending wherever Visa is accepted.',
    },
    {
        id: '1',
        question: 'Where does it work?',
        answer: 'Accepted wherever Visa is accepted — about 150 million merchants. Online, in-store, ATMs.',
    },
    {
        id: '2',
        question: 'Is my money safe?',
        answer: "It's yours. Non-custodial — your stablecoins stay in your wallet until the moment you use the card. We don't hold custody. We don't lend it out.",
    },
    {
        id: '3',
        question: "What's the $10?",
        answer: 'A welcome reward. Complete verification + first $100 in card spend → $10 unlocked to your balance. Same deal whether you signed up yourself or got referred. If you referred someone, you also are eligible for $10 when they activate. Subject to eligibility and program terms.',
    },
    {
        id: '4',
        question: 'How long is the waitlist?',
        answer: "We're letting in about 20 people a week during closed beta. Order matters. Badges skip the line entirely.",
    },
    {
        id: '5',
        question: 'Where can I get the card?',
        answer: "We're rolling out to select regions first and adding more as our partners' coverage expands. Eligibility is shown during signup.",
    },
    {
        id: '6',
        question: 'Any fees?',
        answer: 'No monthly fees. No annual fees. Standard fees and limits apply per the cardholder terms.',
    },
    {
        id: '7',
        question: 'Why "shhhhh"?',
        answer: "We'd rather under-promise and over-deliver to a small group than blast the whole internet on day one. Word travels.",
    },
]

export default function ShhhhhLandingPage() {
    const { user } = useAuth()
    const router = useRouter()

    useEffect(() => {
        if (underMaintenanceConfig.disableCardPioneers) {
            router.replace('/')
        }
    }, [router])

    if (underMaintenanceConfig.disableCardPioneers) {
        return null
    }

    const handleCTA = () => {
        if (user) {
            router.push('/card')
        } else {
            router.push('/setup?redirect_uri=/shhhhh')
        }
    }

    const marqueeProps = { visible: true, message: marqueeMessages }

    return (
        <>
            {/* §1 — Hero (pink) */}
            <section className="relative overflow-hidden bg-primary-1 px-4 py-20 text-n-1 md:py-24">
                <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-[1.1fr_0.9fr]">
                    <div className="text-center md:text-left">
                        <h1 className="font-roboto-flex-extrabold text-[5rem] font-extraBlack leading-[0.82] tracking-[-0.06em] md:text-[9rem] lg:text-[11rem]">
                            shhhhh.
                        </h1>
                        <p className="font-roboto-flex-extrabold mt-6 max-w-xl text-2xl font-extraBlack leading-tight md:text-3xl">
                            The peanut card is out. For you. Maybe.
                        </p>
                        <p className="font-roboto-flex mt-6 max-w-xl text-base leading-relaxed md:text-lg">
                            A card accepted at over 150 million Visa-accepting merchants. We&apos;re letting beta users
                            in slowly —{' '}
                            <span className="inline-block whitespace-nowrap bg-n-1 px-2 py-0.5 text-[0.92em] font-extraBlack uppercase tracking-wider text-primary-1">
                                only 20
                            </span>{' '}
                            a week. If you&apos;ve got the right badge, you skip the line entirely.
                        </p>
                        <div className="mt-8 flex flex-col items-center gap-5 md:flex-row md:items-center md:gap-6">
                            <Button
                                variant="purple"
                                shadowSize="4"
                                onClick={handleCTA}
                                className="bg-white px-10 py-5 text-lg font-extrabold uppercase tracking-wider text-n-1 md:px-12 md:py-6 md:text-xl"
                            >
                                Try the door
                            </Button>
                            <button
                                type="button"
                                onClick={handleCTA}
                                className="font-roboto-flex text-base font-bold underline underline-offset-4"
                            >
                                or join the waitlist →
                            </button>
                        </div>
                    </div>
                    <div className="flex justify-center md:justify-end">
                        <Image
                            src={CARD_GRADIENT_10}
                            alt="peanut card"
                            priority
                            className="w-full max-w-md -rotate-12 drop-shadow-[16px_24px_0_#000]"
                        />
                    </div>
                </div>
            </section>

            <Marquee {...marqueeProps} />

            {/* §2 — What it does (yellow) */}
            <section className="relative overflow-hidden bg-secondary-1 px-4 py-24 text-center text-n-1 md:py-32">
                <div className="mx-auto max-w-5xl">
                    <h2 className="font-roboto-flex-extrabold mx-auto max-w-3xl text-4xl font-extraBlack leading-[0.88] md:text-6xl lg:text-7xl">
                        It&apos;s a card.
                        <br />
                        That&apos;s the whole trick.
                    </h2>
                    <p className="font-roboto-flex mx-auto mt-8 max-w-2xl text-lg leading-relaxed md:text-xl">
                        Top up with stablecoins. Tap at any Visa-accepting merchant — groceries in Lisbon, a hotel in
                        Tokyo, coffee in Buenos Aires, an Uber pretty much anywhere on the planet. Your balance is
                        yours.
                    </p>
                    <div className="mt-12 flex flex-wrap justify-center gap-3 md:flex-nowrap md:gap-4">
                        {stats.map((stat) => (
                            <div
                                key={stat.label}
                                className="flex basis-[calc(50%-0.375rem)] flex-col items-center justify-center rounded-sm border-2 border-n-1 bg-white px-4 py-8 text-center shadow-[4px_4px_0_#000] md:flex-1 md:basis-0 md:py-10"
                            >
                                <div className="font-roboto-flex-extrabold text-5xl font-extraBlack leading-none tracking-tight md:text-6xl">
                                    {stat.value}
                                </div>
                                <div className="font-roboto-flex mt-3 text-xs font-bold uppercase tracking-wider md:text-sm">
                                    {stat.label}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* §3 — Who it's for (BLACK) */}
            <section className="relative overflow-hidden bg-n-1 px-4 py-24 text-white md:py-32">
                <div className="mx-auto max-w-3xl">
                    <h2 className="font-roboto-flex-extrabold text-4xl font-extraBlack leading-[0.95] md:text-6xl">
                        If you live in more than one country, this is for you.
                    </h2>
                    <p className="font-roboto-flex mt-10 text-lg leading-relaxed opacity-90 md:text-xl">
                        We built peanut for people who don&apos;t fit. Digital nomads who get bounced by every
                        neobank&apos;s verification the moment they cross a border. Expats who pay 4% on every
                        transaction home. LATAM users who earn in dollars and spend in pesos and reais.
                    </p>
                </div>
            </section>

            <Marquee {...marqueeProps} />

            {/* §4 — How to get in (pink, 2 doors) */}
            <section className="relative overflow-hidden bg-primary-1 px-4 py-24 text-n-1 md:py-32">
                <div className="mx-auto max-w-5xl">
                    <h2 className="font-roboto-flex-extrabold text-center text-4xl font-extraBlack leading-tight md:text-6xl">
                        How to get in.
                    </h2>
                    <p className="font-roboto-flex mt-3 text-center text-xl font-bold md:text-2xl">
                        Two doors. Pick yours.
                    </p>
                    <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
                        <div className="rounded-sm border-2 border-n-1 bg-white p-8 shadow-[10px_10px_0_#000] md:p-10">
                            <div
                                className="font-roboto-flex-extrabold text-6xl font-extraBlack leading-none text-primary-1"
                                style={{ WebkitTextStroke: '2px #000' }}
                            >
                                01
                            </div>
                            <h3 className="font-roboto-flex-extrabold mt-5 text-3xl font-extraBlack leading-tight md:text-4xl">
                                Got a badge.
                            </h3>
                            <p className="font-roboto-flex mt-4 text-base leading-relaxed">
                                You skip the line. We&apos;re whitelisting holders of:
                            </p>
                            <ul className="mt-4 space-y-3">
                                {badges.map((b) => (
                                    <li key={b.code} className="flex items-center gap-3">
                                        <span
                                            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-sm border-2 border-n-1 font-mono text-sm font-extrabold shadow-[3px_3px_0_#000] ${b.classes}`}
                                        >
                                            {b.short}
                                        </span>
                                        <span className="break-all font-mono text-xs leading-tight">{b.code}</span>
                                    </li>
                                ))}
                            </ul>
                            <p className="font-roboto-flex mt-5 text-base leading-relaxed">
                                Sign in, we check the badges on your account, you go straight to verification. No peanut
                                account yet? Sign up first — takes a minute.
                            </p>
                        </div>

                        <div className="rounded-sm border-2 border-n-1 bg-white p-8 shadow-[10px_10px_0_#000] md:p-10">
                            <div
                                className="font-roboto-flex-extrabold text-6xl font-extraBlack leading-none text-primary-1"
                                style={{ WebkitTextStroke: '2px #000' }}
                            >
                                02
                            </div>
                            <h3 className="font-roboto-flex-extrabold mt-5 text-3xl font-extraBlack leading-tight md:text-4xl">
                                No badge.
                            </h3>
                            <p className="font-roboto-flex mt-4 text-base leading-relaxed">
                                Join the waitlist. We let people in 20 a week.
                            </p>
                            <p className="font-roboto-flex mt-3 text-base leading-relaxed">
                                Put your name on the list and we&apos;ll holler when your turn comes up.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* §5 — Probably not for you (yellow) */}
            <section className="relative overflow-hidden bg-secondary-1 px-4 py-24 text-n-1 md:py-32">
                <div className="mx-auto max-w-3xl">
                    <h2 className="font-roboto-flex-extrabold text-4xl font-extraBlack leading-tight md:text-6xl">
                        Probably not for you.
                    </h2>
                    <p className="font-roboto-flex mt-8 text-lg leading-relaxed md:text-xl">
                        If your money lives in one country and one currency, your bank card already works. Keep it.
                    </p>
                    <p className="font-roboto-flex mt-4 text-lg leading-relaxed md:text-xl">
                        If your money lives elsewhere — across borders, in dollars, in self-custody — the peanut card
                        was built for you.
                    </p>
                </div>
            </section>

            <Marquee {...marqueeProps} />

            {/* §6 — FAQ (cream) */}
            <section className="relative overflow-hidden" style={{ backgroundColor: '#F9F4F0' }}>
                <FAQsPanel heading="FAQ" questions={faqQuestions} />
            </section>

            {/* §7 — Ready? (BLACK) */}
            <section className="relative overflow-hidden bg-n-1 px-4 py-32 text-center text-white md:py-40">
                <div className="mx-auto max-w-3xl">
                    <h2 className="font-roboto-flex-extrabold text-[5rem] font-extraBlack leading-[0.82] tracking-[-0.06em] md:text-[9rem] lg:text-[10rem]">
                        ready?
                    </h2>
                    <p className="font-roboto-flex-extrabold mt-6 text-2xl font-extraBlack md:text-3xl">
                        Try the door.
                    </p>
                    <div className="mt-10 flex justify-center">
                        <Button
                            variant="purple"
                            shadowSize="4"
                            onClick={handleCTA}
                            className="bg-white px-10 py-5 text-lg font-extrabold uppercase tracking-wider text-n-1 md:px-12 md:py-6 md:text-xl"
                        >
                            Try the door
                        </Button>
                    </div>
                </div>
            </section>
        </>
    )
}
