'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { QuestCard } from './QuestCard'
import handPointing from '@/assets/illustrations/got-it-hand.svg'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { QUEST_CONFIG, getQuestStatus } from '../constants'
import { QuestHeroDecoration } from './QuestHeroDecoration'
import { QuestArrowCta } from './QuestArrowCta'
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
    const questStatus = getQuestStatus()
    const { data: questsData, isLoading } = useAllQuestsLeaderboards(3, useTestTimePeriod)
    const isAuthenticated = !!userId

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
        <section className="relative flex min-h-screen items-center overflow-hidden bg-[#FFC900] px-3 py-12 md:px-4 md:py-16">
            <QuestHeroDecoration secondStarTop="50%" />

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
                    <QuestArrowCta
                        label="EXPLORE QUESTS"
                        onClick={() => router.push('/quests/explore')}
                        className="mt-6 mb-8 md:mt-12 md:mb-12"
                        buttonClassName="bg-white px-6 py-2.5 text-sm font-extrabold hover:bg-white/90 md:px-9 md:py-8 md:text-xl"
                    />
                </div>

                {/* Quests Leaderboards Section */}
                <div className="mt-16 mb-8 text-center md:mt-24">
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
