'use client'
import { motion } from 'framer-motion'
import Layout from '@/components/Global/Layout'
import { Button } from '@/components/0_Bruddle/Button'
import { FAQsPanel } from '@/components/Global/FAQs'
import PioneerCard3D from '@/components/LandingPage/PioneerCard3D'
import Footer from '@/components/LandingPage/Footer'
import { Marquee } from '@/components/LandingPage'
import { useAuth } from '@/context/authContext'
import { useRouter } from 'next/navigation'
import { Star, HandThumbsUp } from '@/assets'
import { useState, useEffect } from 'react'

const faqQuestions = [
    {
        id: '0',
        question: 'What is Card Pioneers?',
        answer: 'Card Pioneers is the early-access program for the Peanut Card. Reserve a spot, get priority rollout access, and unlock Pioneer perks like $5 for every friend you refer.',
    },
    {
        id: '1',
        question: 'How does it work?',
        answer: '1. Reserve your spot by adding $10 in starter card balance. 2. Share your Peanut invite link. 3. When someone joins Card Pioneers through your invite, you earn $5 instantly, plus rewards every time they spend - forever.',
    },
    {
        id: '2',
        question: 'Is the $10 refundable?',
        answer: "Your $10 becomes card balance when your card launches. If you're found not eligible at launch (for example: your region isn't supported, or you can't complete required verification), you can request a refund.",
    },
    {
        id: '3',
        question: 'Where is the card available?',
        answer: "We're rolling out by region in stages: US, Latin America, and Africa. You'll see eligibility details during signup.",
    },
    {
        id: '4',
        question: "Do I earn from my invites' invites too?",
        answer: 'Yes! You earn a smaller part for your entire invite tree. So if you invite someone who becomes a power-referrer, you earn from everyone they bring in too.',
    },
]

const CardLandingPage = () => {
    const { user } = useAuth()
    const router = useRouter()
    const [isMobile, setIsMobile] = useState(false)

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768)
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    const handleCTA = () => {
        if (user) {
            router.push('/card')
        } else {
            router.push('/setup?redirect_uri=/card')
        }
    }

    const marqueeProps = {
        visible: true,
        message: ['GLOBAL', 'NO BORDERS', 'INSTANT', 'SELF-CUSTODIAL', 'NO FEES', '$5 PER INVITE'],
    }

    return (
        <Layout className="enable-select !m-0 w-full !p-0">
            {/* Hero Section - Yellow with card */}
            <section className="relative overflow-hidden bg-yellow-1 py-16 md:py-24">
                {!isMobile && <FloatingStars />}

                <div className="relative mx-auto max-w-6xl px-4">
                    <div className="flex flex-col items-center text-center">
                        <motion.h1
                            className="font-roboto-flex-extrabold text-[3rem] font-extraBlack leading-[0.95] md:text-7xl lg:text-8xl"
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6 }}
                        >
                            YOUR DOLLARS.
                            <br />
                            <span className="text-primary-1">EVERYWHERE.</span>
                        </motion.h1>

                        <motion.p
                            className="font-roboto-flex mt-6 max-w-xl text-xl md:text-2xl"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                        >
                            Pay with QR in Latam. Card for everywhere else.
                            <br />
                            <strong>Self-custodial. Best rates. No hidden fees.</strong>
                        </motion.p>

                        <motion.div
                            className="my-10"
                            initial={{ opacity: 0, scale: 0.9, rotateY: -15 }}
                            animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                            transition={{ duration: 0.8, delay: 0.3 }}
                        >
                            <PioneerCard3D />
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.5 }}
                        >
                            <Button
                                variant="dark"
                                shadowSize="6"
                                onClick={handleCTA}
                                className="px-14 py-5 text-xl font-extrabold"
                            >
                                JOIN PIONEERS
                            </Button>
                            <p className="font-roboto-flex mt-3 text-sm opacity-70">
                                $10 starter balance = your spot secured
                            </p>
                        </motion.div>
                    </div>
                </div>
            </section>

            <Divider />

            <Marquee {...marqueeProps} />

            <Divider />

            {/* How it works - Cream */}
            <section className="relative overflow-hidden py-20" style={{ backgroundColor: '#F9F4F0' }}>
                {!isMobile && <FloatingStars variant="light" />}

                <div className="relative mx-auto max-w-5xl px-4">
                    <motion.h2
                        className="font-roboto-flex-extrabold text-center text-4xl font-extraBlack md:text-6xl"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                    >
                        HOW IT WORKS
                    </motion.h2>

                    <div className="mt-16 flex flex-col gap-4 md:flex-row">
                        <StepCard
                            num="01"
                            title="RESERVE"
                            desc="Add $10 starter balance. It becomes spendable when your card activates."
                            color="bg-yellow-1"
                            delay={0}
                        />
                        <StepCard
                            num="02"
                            title="INVITE"
                            desc="Share your link. Earn $5 instantly for every friend who joins."
                            color="bg-green-1"
                            delay={0.1}
                        />
                        <StepCard
                            num="03"
                            title="SPEND"
                            desc="When we launch in your region, you're first in line. Spend globally."
                            color="bg-primary-1"
                            textLight
                            delay={0.2}
                        />
                    </div>
                </div>
            </section>

            <Divider />

            {/* Earn Forever - Dark */}
            <section className="relative overflow-hidden bg-n-1 py-20 text-white">
                <div className="mx-auto max-w-5xl px-4">
                    <div className="flex flex-col items-center gap-12 md:flex-row">
                        {/* Visual - Playful Invite Cascade */}
                        <motion.div
                            className="w-full md:w-1/2"
                            initial={{ opacity: 0, x: -30 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6 }}
                        >
                            <div className="relative mx-auto flex flex-col items-center py-4">
                                {/* Row 1: YOU */}
                                <motion.div
                                    className="relative z-10 flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-yellow-1 text-xl font-black"
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ type: 'spring', damping: 5, delay: 0.1 }}
                                >
                                    YOU
                                </motion.div>

                                {/* Connector to Level 1 */}
                                <div className="h-6 w-0.5 bg-white/40" />

                                {/* Row 2: Direct invites - 3 nodes */}
                                <div className="flex items-start gap-6">
                                    {[0, 1, 2].map((i) => (
                                        <motion.div
                                            key={i}
                                            className="flex flex-col items-center"
                                            initial={{ opacity: 0, y: 20 }}
                                            whileInView={{ opacity: 1, y: 0 }}
                                            viewport={{ once: true }}
                                            transition={{ type: 'spring', damping: 5, delay: 0.3 + i * 0.1 }}
                                        >
                                            <div className="border-3 flex h-14 w-14 items-center justify-center rounded-full border-white bg-green-1">
                                                <motion.img
                                                    src={HandThumbsUp.src}
                                                    alt=""
                                                    className="h-7 w-7"
                                                    animate={{ rotate: [0, 10, -10, 0] }}
                                                    transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
                                                />
                                            </div>
                                            <span className="mt-2 rounded-full bg-yellow-1 px-2 py-0.5 text-xs font-bold text-n-1">
                                                +$5
                                            </span>
                                        </motion.div>
                                    ))}
                                </div>

                                {/* Connector to Level 2 */}
                                <div className="h-6 w-0.5 bg-white/30" />

                                {/* Row 3: Their invites - 6 smaller nodes */}
                                <div className="flex justify-center gap-2 md:gap-3">
                                    {[0, 1, 2, 3, 4, 5].map((i) => (
                                        <motion.div
                                            key={i}
                                            className="flex flex-col items-center"
                                            initial={{ opacity: 0, scale: 0.5 }}
                                            whileInView={{ opacity: 1, scale: 1 }}
                                            viewport={{ once: true }}
                                            transition={{ type: 'spring', damping: 5, delay: 0.6 + i * 0.05 }}
                                        >
                                            <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white/60 bg-secondary-1 md:h-9 md:w-9">
                                                <motion.img
                                                    src={HandThumbsUp.src}
                                                    alt=""
                                                    className="h-3.5 w-3.5 opacity-80 md:h-4 md:w-4"
                                                    animate={{ rotate: [0, 8, -8, 0] }}
                                                    transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.15 }}
                                                />
                                            </div>
                                            <span className="mt-1 text-[10px] font-medium text-white/60">+%</span>
                                        </motion.div>
                                    ))}
                                </div>

                                <motion.p
                                    className="font-roboto-flex mt-6 text-center text-sm text-white/50"
                                    initial={{ opacity: 0 }}
                                    whileInView={{ opacity: 1 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: 0.9 }}
                                >
                                    Earn from your entire invite tree
                                </motion.p>
                            </div>
                        </motion.div>

                        {/* Copy */}
                        <motion.div
                            className="w-full text-center md:w-1/2 md:text-left"
                            initial={{ opacity: 0, x: 30 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6 }}
                        >
                            <h2 className="font-roboto-flex-extrabold text-4xl font-extraBlack md:text-5xl">
                                INVITE ONCE.
                                <br />
                                <span className="text-yellow-1">EARN FOREVER.</span>
                            </h2>

                            <div className="mt-8 space-y-4">
                                <RewardItem amount="$5" label="per Pioneer signup" />
                                <RewardItem amount="%" label="from their card spending" />
                                <RewardItem amount="+" label="from their invites too" />
                            </div>

                            <Button
                                variant="yellow"
                                shadowSize="4"
                                onClick={handleCTA}
                                className="mt-8 px-10 py-4 text-lg font-extrabold"
                            >
                                START EARNING
                            </Button>
                        </motion.div>
                    </div>
                </div>
            </section>

            <Divider />

            <Marquee {...marqueeProps} />

            <Divider />

            {/* Coverage - Yellow */}
            <section className="relative overflow-hidden bg-yellow-1 py-20">
                {!isMobile && <FloatingStars />}

                <div className="relative mx-auto max-w-4xl px-4 text-center">
                    <motion.h2
                        className="font-roboto-flex-extrabold text-4xl font-extraBlack md:text-6xl"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                    >
                        ROLLING OUT
                        <br />
                        <span className="text-primary-1">GLOBALLY</span>
                    </motion.h2>

                    <p className="font-roboto-flex mt-6 text-xl">
                        Starting with <strong>US</strong>, <strong>Latin America</strong>, and <strong>Africa</strong>
                    </p>

                    <motion.div
                        className="mt-10 flex flex-wrap justify-center gap-3"
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.2 }}
                    >
                        {['US', 'Brazil', 'Argentina', 'Mexico', 'Nigeria', 'Kenya', 'South Africa', '+ more'].map(
                            (country, i) => (
                                <motion.span
                                    key={country}
                                    className="rounded-full border-2 border-n-1 bg-white px-5 py-2 text-sm font-bold shadow-sm"
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    whileInView={{ opacity: 1, scale: 1 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: 0.1 * i }}
                                    whileHover={{ scale: 1.05, y: -2 }}
                                >
                                    {country}
                                </motion.span>
                            )
                        )}
                    </motion.div>
                </div>
            </section>

            <Divider />

            {/* FAQ - Cream */}
            <section className="relative overflow-hidden py-20" style={{ backgroundColor: '#F9F4F0' }}>
                {!isMobile && <FloatingStars variant="light" />}

                <div className="relative mx-auto max-w-3xl px-4">
                    <motion.div
                        className="mb-10 text-center"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                    >
                        <span className="font-roboto-flex mb-2 inline-block rounded-full bg-yellow-1 px-4 py-1 text-sm font-bold">
                            Got questions?
                        </span>
                        <h2 className="font-roboto-flex-extrabold mt-4 text-4xl font-extraBlack md:text-5xl">FAQ</h2>
                    </motion.div>
                    <FAQsPanel questions={faqQuestions} />
                    <motion.p
                        className="font-roboto-flex mt-8 text-center text-sm opacity-60"
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 0.6 }}
                        viewport={{ once: true }}
                    >
                        More questions? Visit our{' '}
                        <a href="https://peanut.me/support" className="underline hover:text-primary-1">
                            support page
                        </a>
                    </motion.p>
                </div>
            </section>

            <Divider />

            {/* Final CTA - Dark */}
            <section className="relative overflow-hidden bg-n-1 py-24 text-center text-white">
                {/* Subtle yellow glow accents */}
                <div className="bg-yellow-1/8 absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl" />

                <div className="relative mx-auto max-w-2xl px-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                    >
                        <span className="font-roboto-flex mb-4 inline-block rounded-full border border-white/20 bg-white/10 px-4 py-1 text-sm">
                            Early access is open
                        </span>
                    </motion.div>
                    <motion.h2
                        className="font-roboto-flex-extrabold text-4xl font-extraBlack md:text-6xl"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                    >
                        READY TO
                        <br />
                        <span className="text-yellow-1">JOIN?</span>
                    </motion.h2>
                    <motion.p
                        className="font-roboto-flex mt-4 text-xl text-white/70"
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.1 }}
                    >
                        $10 reserves your spot. Earn $5 for every friend.
                    </motion.p>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.2 }}
                    >
                        <Button
                            variant="yellow"
                            shadowSize="6"
                            onClick={handleCTA}
                            className="mt-8 px-14 py-5 text-xl font-extrabold"
                        >
                            BECOME A PIONEER
                        </Button>
                    </motion.div>
                </div>
            </section>

            <Footer />
        </Layout>
    )
}

// Floating stars component - matches Manteca.tsx pattern exactly
const FloatingStars = ({ variant = 'default' }: { variant?: 'default' | 'light' | 'dark' }) => {
    // Match Manteca's star configuration pattern
    const starConfigs = [
        { className: 'absolute left-12 top-10', delay: 0.2 },
        { className: 'absolute left-56 top-1/2', delay: 0.2 },
        { className: 'absolute bottom-20 left-20', delay: 0.2 },
        { className: 'absolute -top-16 right-20 md:top-10', delay: 0.6 },
        { className: 'absolute bottom-20 right-44', delay: 0.6 },
    ]

    return (
        <>
            {starConfigs.map((config, index) => (
                <motion.img
                    key={index}
                    src={Star.src}
                    alt=""
                    width={50}
                    height={50}
                    className={`${config.className} hidden md:block`}
                    style={{
                        opacity: variant === 'light' ? 0.6 : 1,
                    }}
                    // Exact Manteca animation pattern
                    initial={{ opacity: 0, translateY: 20, translateX: 5, rotate: 22 }}
                    whileInView={{ opacity: variant === 'light' ? 0.6 : 1, translateY: 0, translateX: 0, rotate: 22 }}
                    transition={{ type: 'spring', damping: 5, delay: config.delay }}
                />
            ))}
        </>
    )
}

// Step card component
const StepCard = ({
    num,
    title,
    desc,
    color,
    textLight,
    delay,
}: {
    num: string
    title: string
    desc: string
    color: string
    textLight?: boolean
    delay: number
}) => (
    <motion.div
        className={`flex-1 rounded-2xl border-2 border-n-1 p-6 shadow-md ${color} ${textLight ? 'text-white' : ''}`}
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay }}
        whileHover={{ y: -4, transition: { duration: 0.2 } }}
    >
        <span className={`font-roboto-flex text-5xl font-black ${textLight ? 'text-white/30' : 'opacity-20'}`}>
            {num}
        </span>
        <h3 className="font-roboto-flex-extrabold mt-2 text-2xl font-bold">{title}</h3>
        <p className={`font-roboto-flex mt-2 ${textLight ? 'text-white/80' : 'opacity-70'}`}>{desc}</p>
    </motion.div>
)

// Divider component - single border line
const Divider = () => <div className="border-t border-n-1" />

// Reward item component
const RewardItem = ({ amount, label }: { amount: string; label: string }) => (
    <motion.div
        className="flex items-center gap-4"
        initial={{ opacity: 0, x: -20 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
    >
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-1 text-lg font-black text-n-1">
            {amount}
        </span>
        <span className="font-roboto-flex text-lg">{label}</span>
    </motion.div>
)

export default CardLandingPage
