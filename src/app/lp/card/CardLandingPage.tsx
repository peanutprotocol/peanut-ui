'use client'
import { motion } from 'framer-motion'
import Image from 'next/image'
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
import underMaintenanceConfig from '@/config/underMaintenance.config'

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

    // feature flag: redirect to landing if card pioneers is disabled
    useEffect(() => {
        if (underMaintenanceConfig.disableCardPioneers) {
            router.replace('/')
        }
    }, [router])

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768)
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    if (underMaintenanceConfig.disableCardPioneers) {
        return null
    }

    const handleCTA = () => {
        if (user) {
            router.push('/card')
        } else {
            router.push('/setup?redirect_uri=/card')
        }
    }

    // Marquee copy from CARD_coremessaging.md
    const marqueeProps = {
        visible: true,
        message: ['EARLY = EARN', 'BUILD YOUR TREE', 'ONE LINK', 'LIFETIME UPSIDE', '$5 PER INVITE', 'EARN FOREVER'],
    }

    return (
        <Layout className="enable-select !m-0 w-full !p-0">
            {/* Hero Section - Yellow with card */}
            <section id="hero" className="relative overflow-hidden bg-yellow-1 py-16 md:py-24">
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
                            EVERYWHERE.
                        </motion.h1>

                        <motion.p
                            className="font-roboto-flex mt-6 max-w-xl text-xl md:text-2xl"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                        >
                            Pay with the peanut card. Earn with every purchase, yours or your friends.
                            <br />
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
                                shadowSize="4"
                                onClick={handleCTA}
                                className="bg-white px-14 py-5 text-xl font-extrabold hover:bg-white/90"
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

            <Marquee {...marqueeProps} />

            {/* How it works - Cream */}
            <section
                id="how-it-works"
                className="relative overflow-hidden py-20"
                style={{ backgroundColor: '#F9F4F0' }}
            >
                {!isMobile && <FloatingStars />}

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
                            desc="Share your link. Earn $5 instantly, and earn more forever for every friend you invite."
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

            <Marquee {...marqueeProps} />

            {/* Earn Forever - Cream Background */}
            <section
                id="earn-forever"
                className="relative overflow-hidden py-20"
                style={{ backgroundColor: '#F9F4F0' }}
            >
                {!isMobile && <FloatingStars />}
                <div className="mx-auto max-w-5xl px-4">
                    <div className="flex flex-col items-center gap-12 md:flex-row">
                        {/* Visual - Simplified Invite Visual */}
                        <motion.div
                            className="w-full md:w-1/2"
                            initial={{ opacity: 0, x: -30 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6 }}
                        >
                            <div className="relative mx-auto" style={{ width: 340, height: 380 }}>
                                {/*
                                    LAYOUT - Calculated with Python trigonometry
                                    Container: 340x380

                                    L0 (YOU): center (170, 190), 80x80px
                                    L1 nodes: 48x48px, 120px from YOU
                                      - Top: center (170, 70) - outward angle -90°
                                      - Bottom-left: center (70, 310) - outward angle 129.8°
                                      - Bottom-right: center (270, 310) - outward angle 50.2°

                                    L2 nodes: 32x32px, 55px from parent L1 center, fanning at -45°, 0°, +45° from outward direction
                                      Top L1 (170,70): (131,31), (170,15), (209,31)
                                      Bottom-left L1 (70,310): (75,365), (35,352), (15,315)
                                      Bottom-right L1 (270,310): (325,315), (305,352), (265,365)
                                */}

                                {/* Connection lines */}
                                <svg width="340" height="380" className="absolute left-0 top-0">
                                    {/* L0 to L1 edges */}
                                    <line
                                        x1="170"
                                        y1="190"
                                        x2="170"
                                        y2="70"
                                        stroke="#000"
                                        strokeOpacity="0.15"
                                        strokeWidth="2"
                                    />
                                    <line
                                        x1="170"
                                        y1="190"
                                        x2="70"
                                        y2="310"
                                        stroke="#000"
                                        strokeOpacity="0.15"
                                        strokeWidth="2"
                                    />
                                    <line
                                        x1="170"
                                        y1="190"
                                        x2="270"
                                        y2="310"
                                        stroke="#000"
                                        strokeOpacity="0.15"
                                        strokeWidth="2"
                                    />

                                    {/* Top L1 (170,70) to L2 */}
                                    <line
                                        x1="170"
                                        y1="70"
                                        x2="131"
                                        y2="31"
                                        stroke="#000"
                                        strokeOpacity="0.1"
                                        strokeWidth="1"
                                    />
                                    <line
                                        x1="170"
                                        y1="70"
                                        x2="170"
                                        y2="15"
                                        stroke="#000"
                                        strokeOpacity="0.1"
                                        strokeWidth="1"
                                    />
                                    <line
                                        x1="170"
                                        y1="70"
                                        x2="209"
                                        y2="31"
                                        stroke="#000"
                                        strokeOpacity="0.1"
                                        strokeWidth="1"
                                    />

                                    {/* Bottom-left L1 (70,310) to L2 */}
                                    <line
                                        x1="70"
                                        y1="310"
                                        x2="75"
                                        y2="365"
                                        stroke="#000"
                                        strokeOpacity="0.1"
                                        strokeWidth="1"
                                    />
                                    <line
                                        x1="70"
                                        y1="310"
                                        x2="35"
                                        y2="352"
                                        stroke="#000"
                                        strokeOpacity="0.1"
                                        strokeWidth="1"
                                    />
                                    <line
                                        x1="70"
                                        y1="310"
                                        x2="15"
                                        y2="315"
                                        stroke="#000"
                                        strokeOpacity="0.1"
                                        strokeWidth="1"
                                    />

                                    {/* Bottom-right L1 (270,310) to L2 */}
                                    <line
                                        x1="270"
                                        y1="310"
                                        x2="325"
                                        y2="315"
                                        stroke="#000"
                                        strokeOpacity="0.1"
                                        strokeWidth="1"
                                    />
                                    <line
                                        x1="270"
                                        y1="310"
                                        x2="305"
                                        y2="352"
                                        stroke="#000"
                                        strokeOpacity="0.1"
                                        strokeWidth="1"
                                    />
                                    <line
                                        x1="270"
                                        y1="310"
                                        x2="265"
                                        y2="365"
                                        stroke="#000"
                                        strokeOpacity="0.1"
                                        strokeWidth="1"
                                    />
                                </svg>

                                {/* L0: YOU node - center (170,190), top-left (130,150) */}
                                <div
                                    className="absolute flex items-center justify-center rounded-full border-4 border-n-1 bg-yellow-1 text-xl font-black"
                                    style={{ width: 80, height: 80, top: 150, left: 130 }}
                                >
                                    YOU
                                </div>

                                {/* +$5 BADGES - at visual midpoint between node edges
                                    Top edge: YOU bottom (y=150) to L1 top (y=94) -> visual mid = (150+94)/2 = 122, badge top = 114
                                    Bottom edges: at midpoint of line between centers
                                */}
                                <span
                                    className="absolute rounded-full bg-primary-1 px-2 py-0.5 text-[10px] font-bold text-white"
                                    style={{ top: 114, left: 155 }}
                                >
                                    +$5
                                </span>
                                <span
                                    className="absolute rounded-full bg-primary-1 px-2 py-0.5 text-[10px] font-bold text-white"
                                    style={{ top: 242, left: 103 }}
                                >
                                    +$5
                                </span>
                                <span
                                    className="absolute rounded-full bg-primary-1 px-2 py-0.5 text-[10px] font-bold text-white"
                                    style={{ top: 242, left: 207 }}
                                >
                                    +$5
                                </span>

                                {/* L1: Top primary - center (170,70), top-left (146,46) */}
                                <div
                                    className="absolute flex h-12 w-12 items-center justify-center rounded-full border-2 border-n-1 bg-green-1"
                                    style={{ top: 46, left: 146 }}
                                >
                                    <motion.img
                                        src={HandThumbsUp.src}
                                        alt=""
                                        className="h-6 w-6"
                                        animate={{ rotate: [0, 10, -10, 0] }}
                                        transition={{ duration: 2, repeat: Infinity, delay: 0 }}
                                    />
                                </div>

                                {/* L1: Bottom-left primary - center (70,310), top-left (46,286) */}
                                <div
                                    className="absolute flex h-12 w-12 items-center justify-center rounded-full border-2 border-n-1 bg-green-1"
                                    style={{ top: 286, left: 46 }}
                                >
                                    <motion.img
                                        src={HandThumbsUp.src}
                                        alt=""
                                        className="h-6 w-6"
                                        animate={{ rotate: [0, 10, -10, 0] }}
                                        transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
                                    />
                                </div>

                                {/* L1: Bottom-right primary - center (270,310), top-left (246,286) */}
                                <div
                                    className="absolute flex h-12 w-12 items-center justify-center rounded-full border-2 border-n-1 bg-green-1"
                                    style={{ top: 286, left: 246 }}
                                >
                                    <motion.img
                                        src={HandThumbsUp.src}
                                        alt=""
                                        className="h-6 w-6"
                                        animate={{ rotate: [0, 10, -10, 0] }}
                                        transition={{ duration: 2, repeat: Infinity, delay: 0.6 }}
                                    />
                                </div>

                                {/* L2 NODES - positioned directly at calculated centers
                                    Each node is 32x32, so top-left = center - 16
                                    Top L1 (170,70): L2 at (131,31), (170,15), (209,31)
                                    Bottom-left L1 (70,310): L2 at (75,365), (35,352), (15,315)
                                    Bottom-right L1 (270,310): L2 at (325,315), (305,352), (265,365)
                                */}

                                {/* Top L1's children - labels 2px gap from node edge */}
                                <div
                                    className="absolute flex h-8 w-8 items-center justify-center rounded-full border border-n-1/60 bg-secondary-1"
                                    style={{ top: 15, left: 115 }}
                                >
                                    <motion.img
                                        src={HandThumbsUp.src}
                                        alt=""
                                        className="h-4 w-4"
                                        animate={{ rotate: [0, 8, -8, 0] }}
                                        transition={{ duration: 2.5, repeat: Infinity, delay: 0.1 }}
                                    />
                                </div>
                                <span
                                    className="absolute text-[8px] font-medium text-n-1/60"
                                    style={{ top: 26, left: 98 }}
                                >
                                    +%
                                </span>

                                <div
                                    className="absolute flex h-8 w-8 items-center justify-center rounded-full border border-n-1/60 bg-secondary-1"
                                    style={{ top: -1, left: 154 }}
                                >
                                    <motion.img
                                        src={HandThumbsUp.src}
                                        alt=""
                                        className="h-4 w-4"
                                        animate={{ rotate: [0, 8, -8, 0] }}
                                        transition={{ duration: 2.5, repeat: Infinity, delay: 0.2 }}
                                    />
                                </div>
                                <span
                                    className="absolute text-[8px] font-medium text-n-1/60"
                                    style={{ top: -18, left: 163 }}
                                >
                                    +%
                                </span>

                                <div
                                    className="absolute flex h-8 w-8 items-center justify-center rounded-full border border-n-1/60 bg-secondary-1"
                                    style={{ top: 15, left: 193 }}
                                >
                                    <motion.img
                                        src={HandThumbsUp.src}
                                        alt=""
                                        className="h-4 w-4"
                                        animate={{ rotate: [0, 8, -8, 0] }}
                                        transition={{ duration: 2.5, repeat: Infinity, delay: 0.3 }}
                                    />
                                </div>
                                <span
                                    className="absolute text-[8px] font-medium text-n-1/60"
                                    style={{ top: 26, left: 227 }}
                                >
                                    +%
                                </span>

                                {/* Bottom-left L1's children */}
                                <div
                                    className="absolute flex h-8 w-8 items-center justify-center rounded-full border border-n-1/60 bg-secondary-1"
                                    style={{ top: 349, left: 59 }}
                                >
                                    <motion.img
                                        src={HandThumbsUp.src}
                                        alt=""
                                        className="h-4 w-4"
                                        animate={{ rotate: [0, 8, -8, 0] }}
                                        transition={{ duration: 2.5, repeat: Infinity, delay: 0.4 }}
                                    />
                                </div>
                                <span
                                    className="absolute text-[8px] font-medium text-n-1/60"
                                    style={{ top: 379, left: 68 }}
                                >
                                    +%
                                </span>

                                <div
                                    className="absolute flex h-8 w-8 items-center justify-center rounded-full border border-n-1/60 bg-secondary-1"
                                    style={{ top: 336, left: 19 }}
                                >
                                    <motion.img
                                        src={HandThumbsUp.src}
                                        alt=""
                                        className="h-4 w-4"
                                        animate={{ rotate: [0, 8, -8, 0] }}
                                        transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
                                    />
                                </div>
                                <span
                                    className="absolute text-[8px] font-medium text-n-1/60"
                                    style={{ top: 347, left: 2 }}
                                >
                                    +%
                                </span>

                                <div
                                    className="absolute flex h-8 w-8 items-center justify-center rounded-full border border-n-1/60 bg-secondary-1"
                                    style={{ top: 299, left: 0 }}
                                >
                                    <motion.img
                                        src={HandThumbsUp.src}
                                        alt=""
                                        className="h-4 w-4"
                                        animate={{ rotate: [0, 8, -8, 0] }}
                                        transition={{ duration: 2.5, repeat: Infinity, delay: 0.6 }}
                                    />
                                </div>
                                <span
                                    className="absolute text-[8px] font-medium text-n-1/60"
                                    style={{ top: 310, left: -13 }}
                                >
                                    +%
                                </span>

                                {/* Bottom-right L1's children */}
                                <div
                                    className="absolute flex h-8 w-8 items-center justify-center rounded-full border border-n-1/60 bg-secondary-1"
                                    style={{ top: 299, left: 309 }}
                                >
                                    <motion.img
                                        src={HandThumbsUp.src}
                                        alt=""
                                        className="h-4 w-4"
                                        animate={{ rotate: [0, 8, -8, 0] }}
                                        transition={{ duration: 2.5, repeat: Infinity, delay: 0.7 }}
                                    />
                                </div>
                                <span
                                    className="absolute text-[8px] font-medium text-n-1/60"
                                    style={{ top: 310, left: 343 }}
                                >
                                    +%
                                </span>

                                <div
                                    className="absolute flex h-8 w-8 items-center justify-center rounded-full border border-n-1/60 bg-secondary-1"
                                    style={{ top: 336, left: 289 }}
                                >
                                    <motion.img
                                        src={HandThumbsUp.src}
                                        alt=""
                                        className="h-4 w-4"
                                        animate={{ rotate: [0, 8, -8, 0] }}
                                        transition={{ duration: 2.5, repeat: Infinity, delay: 0.8 }}
                                    />
                                </div>
                                <span
                                    className="absolute text-[8px] font-medium text-n-1/60"
                                    style={{ top: 347, left: 323 }}
                                >
                                    +%
                                </span>

                                <div
                                    className="absolute flex h-8 w-8 items-center justify-center rounded-full border border-n-1/60 bg-secondary-1"
                                    style={{ top: 349, left: 249 }}
                                >
                                    <motion.img
                                        src={HandThumbsUp.src}
                                        alt=""
                                        className="h-4 w-4"
                                        animate={{ rotate: [0, 8, -8, 0] }}
                                        transition={{ duration: 2.5, repeat: Infinity, delay: 0.9 }}
                                    />
                                </div>
                                <span
                                    className="absolute text-[8px] font-medium text-n-1/60"
                                    style={{ top: 379, left: 258 }}
                                >
                                    +%
                                </span>
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
                                EARN FOREVER.
                            </h2>

                            <div className="mt-8 space-y-4">
                                <RewardItem amount="$5" label="per Pioneer signup" />
                                <RewardItem amount="%" label="from their card spending" />
                                <RewardItem amount="+" label="from their invites too" />
                            </div>

                            <Button
                                shadowSize="4"
                                onClick={handleCTA}
                                className="mt-8 bg-white px-10 py-4 text-lg font-extrabold hover:bg-white/90"
                            >
                                START EARNING
                            </Button>
                        </motion.div>
                    </div>
                </div>
            </section>

            <Marquee {...marqueeProps} />

            {/* Coverage - Yellow */}
            <section id="coverage" className="relative overflow-hidden bg-yellow-1 py-20">
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
                        GLOBALLY
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
                        {/* Individual country flags */}
                        {[
                            { name: 'United States', code: 'us' },
                            { name: 'Brazil', code: 'br' },
                            { name: 'Argentina', code: 'ar' },
                            { name: 'Mexico', code: 'mx' },
                            { name: 'Nigeria', code: 'ng' },
                            { name: 'Kenya', code: 'ke' },
                            { name: 'South Africa', code: 'za' },
                        ].map((country, i) => (
                            <motion.div
                                key={country.code}
                                className="flex items-center gap-2 rounded-full border-2 border-n-1 bg-white px-4 py-2 shadow-sm"
                                initial={{ opacity: 0, scale: 0.8 }}
                                whileInView={{ opacity: 1, scale: 1 }}
                                viewport={{ once: true }}
                                transition={{ delay: 0.1 * i }}
                            >
                                <Image
                                    src={`https://flagcdn.com/w160/${country.code}.png`}
                                    alt={`${country.name} flag`}
                                    width={24}
                                    height={24}
                                    className="h-6 w-6 rounded-full object-cover"
                                />
                                <span className="text-sm font-bold">{country.name}</span>
                            </motion.div>
                        ))}

                        {/* Region pills without flags */}
                        <motion.span
                            className="rounded-full border-2 border-n-1 bg-white px-5 py-2 text-sm font-bold shadow-sm"
                            initial={{ opacity: 0, scale: 0.8 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.7 }}
                        >
                            Latin America
                        </motion.span>
                        <motion.span
                            className="rounded-full border-2 border-n-1 bg-white px-5 py-2 text-sm font-bold shadow-sm"
                            initial={{ opacity: 0, scale: 0.8 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.8 }}
                        >
                            Africa
                        </motion.span>
                        <motion.span
                            className="rounded-full border-2 border-n-1 bg-white px-5 py-2 text-sm font-bold shadow-sm"
                            initial={{ opacity: 0, scale: 0.8 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.9 }}
                        >
                            + more
                        </motion.span>
                    </motion.div>
                </div>
            </section>

            <Marquee {...marqueeProps} />

            {/* FAQ - Cream */}
            <section id="faq" className="relative overflow-hidden py-12" style={{ backgroundColor: '#F9F4F0' }}>
                {!isMobile && <FloatingStars />}

                <div className="relative mx-auto max-w-3xl px-4">
                    <FAQsPanel heading="FAQ" questions={faqQuestions} />
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

            <Marquee {...marqueeProps} />

            {/* Final CTA - Secondary Yellow */}
            <section id="join" className="relative overflow-hidden bg-secondary-1 py-24 text-center text-n-1">
                {!isMobile && <FloatingStars />}

                <div className="relative mx-auto max-w-2xl px-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                    >
                        <span className="font-roboto-flex mb-4 inline-block rounded-full border-2 border-n-1 bg-white px-4 py-1 text-sm font-bold">
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
                        JOIN?
                    </motion.h2>
                    <motion.p
                        className="font-roboto-flex mt-4 text-xl"
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.1 }}
                    >
                        $10 reserves your spot. And for every friend you invite, earn forever.
                    </motion.p>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.2 }}
                    >
                        <Button
                            shadowSize="4"
                            onClick={handleCTA}
                            className="mt-8 bg-white px-14 py-5 text-xl font-extrabold hover:bg-white/90"
                        >
                            BECOME A PIONEER
                        </Button>
                    </motion.div>
                </div>
            </section>

            <Marquee {...marqueeProps} />

            <Footer />
        </Layout>
    )
}

// Floating stars component - matches Manteca.tsx pattern exactly
const FloatingStars = () => {
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
                    // Exact Manteca animation pattern
                    initial={{ opacity: 0, translateY: 20, translateX: 5, rotate: 22 }}
                    whileInView={{ opacity: 1, translateY: 0, translateX: 0, rotate: 22 }}
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
