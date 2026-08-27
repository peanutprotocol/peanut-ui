'use client'

import { use } from 'react'
import Layout from '@/components/Global/Layout'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { Button } from '@/components/0_Bruddle/Button'
import { QuestLeaderboard } from '../components/QuestLeaderboard'
import { UserRankCard } from '../components/UserRankCard'
import { QUEST_CONFIG, getQuestStatus, type QuestId } from '../constants'
import { QuestHeroDecoration } from '../components/QuestHeroDecoration'
import { QuestArrowCta } from '../components/QuestArrowCta'
import { useQuestLeaderboard } from '../hooks/useQuests'
import Loading from '@/components/Global/Loading'
import { useAuth } from '@/context/authContext'

interface QuestDetailPageProps {
    params: Promise<{ questId: string }>
}

export default function QuestDetailPage(props: QuestDetailPageProps) {
    const params = use(props.params)
    const router = useRouter()
    const searchParams = useSearchParams()
    const { userId, username } = useAuth()
    const useTestTimePeriod = searchParams?.get('useTestTimePeriod') === 'true'
    const questStatus = getQuestStatus()
    const questId = params.questId as QuestId
    const { data: questData, isLoading } = useQuestLeaderboard(questId, 10, useTestTimePeriod)

    const questConfig = QUEST_CONFIG[questId]

    if (!questConfig) {
        return (
            <Layout>
                <div className="flex min-h-screen items-center justify-center">
                    <div className="text-center">
                        <h1 className="mb-4 text-4xl font-bold">Quest Not Found</h1>
                        <Button onClick={() => router.push('/quests')}>Back to Quests</Button>
                    </div>
                </div>
            </Layout>
        )
    }

    const leaderboard = questData?.leaderboard || []
    const userStatus = questData?.userStatus
    const isAuthenticated = !!userId

    const bgColorClass =
        questConfig.backgroundColor === 'purple'
            ? 'bg-purple-200'
            : questConfig.backgroundColor === 'pink'
              ? 'bg-pink-200'
              : 'bg-blue-200'

    return (
        <Layout className="enable-select !m-0 w-full !p-0">
            <section className="relative min-h-screen overflow-hidden bg-[#FFC900] px-4 py-16 md:py-24">
                <QuestHeroDecoration />

                {/* Content */}
                <div className="relative z-10 mx-auto max-w-4xl">
                    {/* Back button - Same as explore page */}
                    <motion.button
                        onClick={() => router.push('/quests')}
                        className="mb-8 inline-flex items-center gap-2 rounded-sm border-2 border-black bg-white px-4 py-2 font-bold text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all duration-100 hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none"
                    >
                        <span className="text-xl">←</span>
                        <span>Back</span>
                    </motion.button>

                    {/* Quest Header Card */}
                    <motion.div
                        className={`mb-8 rounded-sm border-2 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] md:p-8 ${bgColorClass}`}
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                            duration: 0.5,
                            delay: 0.1,
                            ease: [0.25, 0.1, 0.25, 1],
                        }}
                    >
                        <div className="mb-6 flex flex-col items-center gap-4 md:flex-row">
                            <div className="relative h-20 w-20 flex-shrink-0 md:h-24 md:w-24">
                                <Image
                                    src={questConfig.iconPath}
                                    alt={questConfig.title}
                                    fill
                                    className="object-contain"
                                />
                            </div>
                            <div className="flex-1 text-center md:text-left">
                                <h1 className="mb-2 text-2xl font-black text-black md:text-3xl">{questConfig.title}</h1>
                                <p className="text-sm">{questConfig.explainer}</p>
                            </div>
                        </div>
                    </motion.div>

                    {/* Leaderboard */}
                    <motion.div
                        className="mb-8"
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                            duration: 0.5,
                            delay: 0.2,
                            ease: [0.25, 0.1, 0.25, 1],
                        }}
                    >
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center rounded-sm border-2 border-black bg-white py-12 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                <Loading variant="mascot" />
                            </div>
                        ) : leaderboard.length === 0 &&
                          !userStatus &&
                          questStatus === 'not_started' &&
                          !useTestTimePeriod ? (
                            <div className="flex flex-col items-center justify-center rounded-sm border-2 border-black bg-white py-12 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                <div className="mb-4 text-5xl">⏰</div>
                                <p className="mb-2 text-lg font-bold">Coming Soon!</p>
                                <p className="text-sm">Leaderboard will be available on November 17th, 2025</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {leaderboard.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center rounded-sm border-2 border-black bg-white py-12 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                        <div className="mb-4 text-4xl">🏆</div>
                                        <p className="mb-2 text-lg font-bold">No entries yet</p>
                                        <p className="text-sm">Be the first to compete!</p>
                                    </div>
                                ) : (
                                    <QuestLeaderboard
                                        entries={leaderboard}
                                        metricLabel={questConfig.metricLabel}
                                        badgeColor={questConfig.badgeColor}
                                        isCurrency={questId === 'bank_drainer'}
                                    />
                                )}

                                {/* User Status - shown as last entry if authenticated */}
                                {isAuthenticated && userStatus && username && (
                                    <UserRankCard
                                        metric={userStatus.metric}
                                        username={username}
                                        isCurrency={questId === 'bank_drainer'}
                                        backgroundColor={questConfig.backgroundColor}
                                    />
                                )}
                            </div>
                        )}
                    </motion.div>

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
