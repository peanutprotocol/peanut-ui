'use client'

import Layout from '@/components/Global/Layout'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import Image from 'next/image'
import borderCloud from '@/assets/illustrations/border-cloud.svg'
import handPointing from '@/assets/illustrations/got-it-hand.svg'
import { Star } from '@/assets'
import { useEffect, useState, useMemo, useCallback } from 'react'
import { Button } from '@/components/0_Bruddle'
import { QuestLeaderboard } from '../components/QuestLeaderboard'
import { UserRankCard } from '../components/UserRankCard'
import { QUEST_CONFIG, getQuestStatus } from '../constants'
import { useAllQuestsLeaderboards } from '../hooks/useQuests'
import PeanutLoading from '@/components/Global/PeanutLoading'

export default function QuestsExplorePage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const useMockData = searchParams?.get('useMockData') === 'true'
    const useTestTimePeriod = searchParams?.get('useTestTimePeriod') === 'true'
    const [screenWidth, setScreenWidth] = useState(1080)
    const questStatus = getQuestStatus()
    const { data: questsData, isLoading } = useAllQuestsLeaderboards(10, useMockData, useTestTimePeriod)

    const quests = useMemo(() => {
        if (!questsData) {
            return [
                { ...QUEST_CONFIG.most_invites, leaderboard: [] },
                { ...QUEST_CONFIG.bank_drainer, leaderboard: [] },
                { ...QUEST_CONFIG.biggest_pot, leaderboard: [] },
            ]
        }

        return [
            {
                ...QUEST_CONFIG.most_invites,
                leaderboard: questsData.most_invites?.leaderboard || [],
            },
            {
                ...QUEST_CONFIG.bank_drainer,
                leaderboard: questsData.bank_drainer?.leaderboard || [],
            },
            {
                ...QUEST_CONFIG.biggest_pot,
                leaderboard: questsData.biggest_pot?.leaderboard || [],
            },
        ]
    }, [questsData])

    useEffect(() => {
        const handleResize = () => {
            setScreenWidth(window.innerWidth)
        }

        handleResize()
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    const createCloudAnimation = useCallback(
        (side: 'left' | 'right', width: number, speed: number) => {
            const vpWidth = screenWidth || 1080
            const totalDistance = vpWidth + width

            return {
                initial: { x: side === 'left' ? -width : vpWidth },
                animate: { x: side === 'left' ? vpWidth : -width },
                transition: {
                    ease: 'linear',
                    duration: totalDistance / speed,
                    repeat: Infinity,
                },
            }
        },
        [screenWidth]
    )

    return (
        <Layout className="enable-select !m-0 w-full !p-0">
            <section className="relative min-h-screen overflow-hidden bg-[#FFC900] px-4 py-16 md:py-24">
                {/* Animated Clouds - Reduced for performance */}
                <div className="absolute left-0 top-0 h-full w-full overflow-hidden">
                    <motion.img
                        src={borderCloud.src}
                        alt=""
                        className="absolute left-0"
                        style={{ top: '15%', width: 180 }}
                        {...createCloudAnimation('left', 180, 35)}
                    />
                    <motion.img
                        src={borderCloud.src}
                        alt=""
                        className="absolute right-0"
                        style={{ top: '40%', width: 200 }}
                        {...createCloudAnimation('right', 200, 40)}
                    />
                    <motion.img
                        src={borderCloud.src}
                        alt=""
                        className="absolute left-0"
                        style={{ top: '70%', width: 190 }}
                        {...createCloudAnimation('left', 190, 38)}
                    />
                </div>

                {/* Stars */}
                <motion.img
                    initial={{ opacity: 0, translateY: 20, translateX: 5 }}
                    whileInView={{ opacity: 1, translateY: 0, translateX: 0 }}
                    transition={{ type: 'spring', damping: 5 }}
                    src={Star.src}
                    alt=""
                    className="absolute hidden md:block"
                    style={{ top: '20%', left: '15%', width: 35 }}
                />
                <motion.img
                    initial={{ opacity: 0, translateY: 28, translateX: -5 }}
                    whileInView={{ opacity: 1, translateY: 0, translateX: 0 }}
                    transition={{ type: 'spring', damping: 5 }}
                    src={Star.src}
                    alt=""
                    className="absolute hidden md:block"
                    style={{ top: '60%', right: '20%', width: 40 }}
                />

                {/* Content */}
                <div className="relative z-10 mx-auto max-w-7xl">
                    {/* Back button */}
                    <motion.button
                        onClick={() => router.push('/quests')}
                        className="mb-8 inline-flex items-center gap-2 rounded-sm border-2 border-black bg-white px-4 py-2 font-bold text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all duration-100 hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none"
                    >
                        <span className="text-xl">←</span>
                        <span>Back</span>
                    </motion.button>

                    {/* Header with Card */}
                    <div className="mb-12 flex justify-center">
                        <div className="inline-block rounded-sm border-2 border-black bg-white px-8 py-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] md:px-12 md:py-8">
                            <div className="mb-4 flex items-center justify-center">
                                <img src="/logos/dvcn.svg" alt="DevConnect" className="h-16 w-auto md:h-24" />
                            </div>
                            <p className="text-center text-base font-black text-black md:text-xl">QUESTS</p>
                            <p className="text-center text-sm font-bold text-gray-700 md:text-base">
                                Nov 17-22, 2025 • Compete & Win up to $1500!
                            </p>
                        </div>
                    </div>

                    {/* Quests Sections - Grid on Desktop */}
                    <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                        {quests.map((quest, index) => {
                            const bgColorClass =
                                quest.backgroundColor === 'purple'
                                    ? 'bg-purple-200'
                                    : quest.backgroundColor === 'pink'
                                      ? 'bg-pink-100'
                                      : 'bg-blue-100'

                            return (
                                <motion.div
                                    key={quest.id}
                                    className={`flex cursor-pointer flex-col rounded-sm border-2 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-transform hover:scale-[1.02] md:p-8 ${bgColorClass}`}
                                    onClick={() => router.push(`/quests/${quest.id}`)}
                                    initial={{ opacity: 0, y: 50 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{
                                        duration: 0.5,
                                        delay: index * 0.15,
                                        ease: [0.25, 0.1, 0.25, 1],
                                    }}
                                >
                                    {/* Quest Header */}
                                    <div className="mb-6 flex flex-col items-center gap-4 md:flex-row">
                                        <div className="relative h-20 w-20 flex-shrink-0 md:h-24 md:w-24">
                                            <Image
                                                src={quest.iconPath}
                                                alt={quest.title}
                                                fill
                                                className="object-contain"
                                            />
                                        </div>
                                        <div className="flex-1 text-center md:text-left">
                                            <h2 className="mb-2 text-2xl font-black text-black md:text-3xl">
                                                {quest.title}
                                            </h2>
                                            <p className="text-sm text-gray-700">{quest.explainer}</p>
                                        </div>
                                    </div>

                                    {/* Top 10 Leaderboard */}
                                    <div className="flex-1">
                                        {isLoading ? (
                                            <div className="flex flex-col items-center justify-center rounded-sm border-2 border-black bg-white py-8 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] md:py-12">
                                                <PeanutLoading />
                                            </div>
                                        ) : quest.leaderboard.length === 0 ? (
                                            questStatus === 'not_started' ? (
                                                <div className="flex flex-col items-center justify-center rounded-sm border-2 border-black bg-white py-8 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] md:py-12">
                                                    <div className="mb-3 text-4xl md:mb-4 md:text-5xl">⏰</div>
                                                    <p className="mb-2 text-base font-bold text-gray-700 md:text-lg">
                                                        Coming Soon!
                                                    </p>
                                                    <p className="text-xs text-gray-500 md:text-sm">
                                                        Leaderboards will be available on November 17th, 2025
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center rounded-sm border-2 border-black bg-white py-8 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] md:py-12">
                                                    <div className="mb-3 text-3xl md:mb-4 md:text-4xl">🏆</div>
                                                    <p className="mb-2 text-base font-bold text-gray-700 md:text-lg">
                                                        No entries yet
                                                    </p>
                                                    <p className="text-xs text-gray-500 md:text-sm">
                                                        Be the first to compete!
                                                    </p>
                                                </div>
                                            )
                                        ) : (
                                            <QuestLeaderboard
                                                entries={quest.leaderboard}
                                                metricLabel="points"
                                                badgeColor={quest.badgeColor}
                                                isCurrency={quest.id === 'bank_drainer'}
                                            />
                                        )}
                                    </div>

                                    {/* User rank card will be displayed here when authentication is implemented */}
                                </motion.div>
                            )
                        })}
                    </div>

                    {/* Main CTA - Like Landing Page */}
                    <motion.div
                        className="relative z-20 mx-auto mb-12 mt-16 flex w-fit flex-col items-center justify-center"
                        initial={{ opacity: 0, translateY: 4, translateX: 0, rotate: 0.75 }}
                        animate={{ opacity: 1, translateY: 0, translateX: 0, rotate: 0, scale: 1 }}
                        whileHover={{ translateY: 6, translateX: 0, rotate: 0.75 }}
                        transition={{ type: 'spring', damping: 15 }}
                        onClick={() => router.push('/setup')}
                        style={{ cursor: 'pointer' }}
                    >
                        <Button
                            shadowSize="4"
                            className="bg-white px-7 py-3 text-base font-extrabold hover:bg-white/90 md:px-9 md:py-8 md:text-xl"
                        >
                            SIGN UP NOW
                        </Button>
                        {/* Arrows like landing page */}
                        <Image
                            src="/arrows/small-arrow.svg"
                            alt="Arrow"
                            width={32}
                            height={16}
                            className="absolute -left-8 -top-5 block -translate-y-1/2 transform md:hidden"
                            style={{ rotate: '8deg' }}
                        />
                        <Image
                            src="/arrows/small-arrow.svg"
                            alt="Arrow"
                            width={32}
                            height={16}
                            className="absolute -right-8 -top-5 block -translate-y-1/2 scale-x-[-1] transform md:hidden"
                            style={{ rotate: '-8deg' }}
                        />
                        <Image
                            src="/arrows/small-arrow.svg"
                            alt="Arrow"
                            width={40}
                            height={20}
                            className="absolute -left-10 -top-6 hidden -translate-y-1/2 transform md:block"
                            style={{ rotate: '8deg' }}
                        />
                        <Image
                            src="/arrows/small-arrow.svg"
                            alt="Arrow"
                            width={40}
                            height={20}
                            className="absolute -right-10 -top-6 hidden -translate-y-1/2 scale-x-[-1] transform md:block"
                            style={{ rotate: '-8deg' }}
                        />
                    </motion.div>
                </div>
            </section>
        </Layout>
    )
}
