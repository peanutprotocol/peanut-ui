'use client'

import Layout from '@/components/Global/Layout'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { useMemo } from 'react'
import { QuestLeaderboard } from '../components/QuestLeaderboard'
import { UserRankCard } from '../components/UserRankCard'
import { QUEST_CONFIG, getQuestStatus } from '../constants'
import { QuestHeroDecoration } from '../components/QuestHeroDecoration'
import { QuestArrowCta } from '../components/QuestArrowCta'
import { useAllQuestsLeaderboards } from '../hooks/useQuests'
import Loading from '@/components/Global/Loading'
import { useAuth } from '@/context/authContext'

export default function QuestsExplorePage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { userId, username } = useAuth()
    const useTestTimePeriod = searchParams?.get('useTestTimePeriod') === 'true'
    const questStatus = getQuestStatus()
    const { data: questsData, isLoading } = useAllQuestsLeaderboards(10, useTestTimePeriod)
    const isAuthenticated = !!userId

    const quests = useMemo(() => {
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
        <Layout className="enable-select !m-0 w-full !p-0">
            <section className="relative min-h-screen overflow-hidden bg-[#FFC900] px-4 py-16 md:py-24">
                <QuestHeroDecoration />

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
                                <Image
                                    src="/logos/dvcn.svg"
                                    alt="DevConnect"
                                    width={305}
                                    height={107}
                                    className="h-16 w-auto md:h-24"
                                />
                            </div>
                            <p className="text-center text-base font-black text-black md:text-xl">QUESTS</p>
                            <p className="text-center text-sm font-bold md:text-base">
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
                                      ? 'bg-pink-200'
                                      : 'bg-blue-200'

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
                                            <p className="text-sm">{quest.explainer}</p>
                                        </div>
                                    </div>

                                    {/* Top 10 Leaderboard */}
                                    <div className="flex-1">
                                        {isLoading ? (
                                            <div className="flex flex-col items-center justify-center rounded-sm border-2 border-black bg-white py-8 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] md:py-12">
                                                <Loading variant="mascot" />
                                            </div>
                                        ) : quest.leaderboard.length === 0 &&
                                          !quest.hasUserData &&
                                          questStatus === 'not_started' &&
                                          !useTestTimePeriod ? (
                                            <div className="flex flex-col items-center justify-center rounded-sm border-2 border-black bg-white py-8 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] md:py-12">
                                                <div className="mb-3 text-4xl md:mb-4 md:text-5xl">⏰</div>
                                                <p className="mb-2 text-base font-bold md:text-lg">Coming Soon!</p>
                                                <p className="text-xs md:text-sm">
                                                    Leaderboards will be available on November 17th, 2025
                                                </p>
                                            </div>
                                        ) : quest.leaderboard.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center rounded-sm border-2 border-black bg-white py-8 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] md:py-12">
                                                <div className="mb-3 text-3xl md:mb-4 md:text-4xl">🏆</div>
                                                <p className="mb-2 text-base font-bold md:text-lg">No entries yet</p>
                                                <p className="text-xs md:text-sm">Be the first to compete!</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                <QuestLeaderboard
                                                    entries={quest.leaderboard}
                                                    metricLabel="points"
                                                    badgeColor={quest.badgeColor}
                                                    isCurrency={quest.id === 'bank_drainer'}
                                                />

                                                {/* User Status - shown as last entry if authenticated */}
                                                {isAuthenticated &&
                                                    username &&
                                                    (quest.id === 'most_invites'
                                                        ? questsData?.most_invites?.userStatus
                                                        : quest.id === 'bank_drainer'
                                                          ? questsData?.bank_drainer?.userStatus
                                                          : questsData?.biggest_pot?.userStatus) && (
                                                        <UserRankCard
                                                            metric={
                                                                (quest.id === 'most_invites'
                                                                    ? questsData?.most_invites?.userStatus?.metric
                                                                    : quest.id === 'bank_drainer'
                                                                      ? questsData?.bank_drainer?.userStatus?.metric
                                                                      : questsData?.biggest_pot?.userStatus?.metric) ||
                                                                0
                                                            }
                                                            username={username}
                                                            isCurrency={quest.id === 'bank_drainer'}
                                                            backgroundColor={quest.backgroundColor}
                                                        />
                                                    )}
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )
                        })}
                    </div>

                    {/* Main CTA - Like Landing Page */}
                    <QuestArrowCta
                        label="SIGN UP NOW"
                        onClick={() => router.push('/setup')}
                        className="mt-16 mb-12"
                        buttonClassName="bg-white px-7 py-3 text-base font-extrabold hover:bg-white/90 md:px-9 md:py-8 md:text-xl"
                    />
                </div>
            </section>
        </Layout>
    )
}
