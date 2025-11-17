'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { QuestCard } from './QuestCard'
import borderCloud from '@/assets/illustrations/border-cloud.svg'
import handPointing from '@/assets/illustrations/got-it-hand.svg'
import { Star } from '@/assets'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/0_Bruddle'
import { QUEST_CONFIG, getQuestStatus } from '../constants'
import { useAllQuestsLeaderboards } from '../hooks/useQuests'
import { useAuth } from '@/context/authContext'

interface QuestData {
    id: string
    title: string
    description: string
    iconPath: string
    badgeColor: string
    backgroundColor: string
    leaderboard: Array<{
        rank: number
        userId: string
        username: string
        metric: number
        badge?: string
    }>
    hasUserData: boolean
}

export function QuestsHero() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { userId, username } = useAuth()
    const useTestTimePeriod = searchParams?.get('useTestTimePeriod') === 'true'
    const [screenWidth, setScreenWidth] = useState(1080)
    const questStatus = getQuestStatus()
    const { data: questsData, isLoading } = useAllQuestsLeaderboards(3, useTestTimePeriod)
    const isAuthenticated = !!userId

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

    const quests: QuestData[] = useMemo(() => {
        if (!questsData) {
            return [
                { ...QUEST_CONFIG.most_invites, leaderboard: [], hasUserData: false },
                { ...QUEST_CONFIG.bank_drainer, leaderboard: [], hasUserData: false },
                { ...QUEST_CONFIG.biggest_pot, leaderboard: [], hasUserData: false },
            ]
        }

        return [
            {
                ...QUEST_CONFIG.most_invites,
                leaderboard: questsData.most_invites?.leaderboard || [],
                hasUserData: !!questsData.most_invites?.userStatus,
            },
            {
                ...QUEST_CONFIG.bank_drainer,
                leaderboard: questsData.bank_drainer?.leaderboard || [],
                hasUserData: !!questsData.bank_drainer?.userStatus,
            },
            {
                ...QUEST_CONFIG.biggest_pot,
                leaderboard: questsData.biggest_pot?.leaderboard || [],
                hasUserData: !!questsData.biggest_pot?.userStatus,
            },
        ]
    }, [questsData])

    return (
        <section className="relative min-h-screen overflow-hidden bg-[#FFC900] px-3 py-12 md:px-4 md:py-24">
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

            {/* Animated Stars - Fade in like landing page */}
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
                style={{ top: '50%', right: '20%', width: 40 }}
            />

            {/* Content */}
            <div className="relative z-10 mx-auto max-w-7xl">
                {/* Header */}
                <div className="mb-12 text-center">
                    <div className="mb-6 flex items-center justify-center gap-3">
                        <h1 className="text-2xl font-black text-black md:text-6xl">JOIN PEANUT AT</h1>
                        <Image
                            src="/logos/dvcn.svg"
                            alt="DevConnect"
                            width={200}
                            height={70}
                            className="h-auto w-32 md:w-48"
                        />
                    </div>

                    <div className="mb-8">
                        <p className="text-lg font-bold text-black md:text-3xl">
                            TAKE PART IN OUR{' '}
                            <span className="font-black underline decoration-black decoration-2 md:decoration-4">
                                QUESTS
                            </span>
                            , COMPETE, AND WIN UP TO <span className="font-black">$1500</span>!
                        </p>
                    </div>

                    {/* Reuse landing page button style with arrows */}
                    <motion.div
                        className="relative z-20 mx-auto mb-8 mt-6 flex w-fit flex-col items-center justify-center md:mb-12 md:mt-12"
                        initial={{ opacity: 0, translateY: 4, translateX: 0, rotate: 0.75 }}
                        animate={{ opacity: 1, translateY: 0, translateX: 0, rotate: 0, scale: 1 }}
                        whileHover={{ translateY: 6, translateX: 0, rotate: 0.75 }}
                        transition={{ type: 'spring', damping: 15 }}
                        onClick={() => router.push('/quests/explore')}
                        style={{ cursor: 'pointer' }}
                    >
                        <Button
                            shadowSize="4"
                            className="bg-white px-6 py-2.5 text-sm font-extrabold hover:bg-white/90 md:px-9 md:py-8 md:text-xl"
                        >
                            EXPLORE QUESTS
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

                {/* Quests Leaderboards Section */}
                <div className="mb-8 mt-16 text-center md:mt-24">
                    <div className="mb-6 flex items-center justify-center gap-2 md:gap-3">
                        <Image src={handPointing} alt="" width={32} height={32} className="h-8 w-8 md:h-12 md:w-12" />
                        <h2 className="text-xl font-black text-black md:text-4xl">QUESTS LEADERBOARDS</h2>
                        <Image
                            src={handPointing}
                            alt=""
                            width={32}
                            height={32}
                            className="h-8 w-8 scale-x-[-1] md:h-12 md:w-12"
                        />
                    </div>
                </div>

                {/* Quest Cards Grid with Top 3 */}
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    {quests.map((quest, index) => (
                        <motion.div
                            key={quest.id}
                            initial={{ opacity: 0, y: 50 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                                duration: 0.5,
                                delay: index * 0.15,
                                ease: [0.25, 0.1, 0.25, 1],
                            }}
                        >
                            <QuestCard
                                title={quest.title}
                                description={quest.description}
                                iconPath={quest.iconPath}
                                leaderboard={quest.leaderboard}
                                badgeColor={quest.badgeColor}
                                backgroundColor={quest.backgroundColor}
                                onClick={() => router.push(`/quests/${quest.id}`)}
                                questStatus={questStatus}
                                isLoading={isLoading}
                                isCurrency={quest.id === 'bank_drainer'}
                                hasUserData={quest.hasUserData}
                                useTestTimePeriod={useTestTimePeriod}
                                userStatus={
                                    quest.id === 'most_invites'
                                        ? questsData?.most_invites?.userStatus
                                        : quest.id === 'bank_drainer'
                                          ? questsData?.bank_drainer?.userStatus
                                          : questsData?.biggest_pot?.userStatus
                                }
                                username={username}
                                isAuthenticated={isAuthenticated}
                            />
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    )
}
