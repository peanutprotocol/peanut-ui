'use client'

import PageContainer from '@/components/0_Bruddle/PageContainer'
import Card from '@/components/Global/Card'
import { getCardPosition } from '@/components/Global/Card/card.utils'
import { Icon } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import NavigationArrow from '@/components/Global/NavigationArrow'
import Loading from '@/components/Global/Loading'
import TransactionAvatarBadge from '@/components/TransactionDetails/TransactionAvatarBadge'
import { VerifiedUserLabel } from '@/components/UserHeader'
import { useAuth } from '@/context/authContext'
import { invitesApi } from '@/services/invites'
import { getInitialsFromName } from '@/utils/general.utils'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useSafeBack } from '@/hooks/useSafeBack'
import STAR_STRAIGHT_ICON from '@/assets/icons/starStraight.svg'
import TIER_0_BADGE from '@/assets/badges/tier0.svg'
import TIER_1_BADGE from '@/assets/badges/tier1.svg'
import TIER_2_BADGE from '@/assets/badges/tier2.svg'
import TIER_3_BADGE from '@/assets/badges/tier3.svg'
import Image from 'next/image'
import { pointsApi } from '@/services/points'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import { type PointsInvite } from '@/services/services.types'
import { useEffect, useRef, useState } from 'react'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import InvitesGraph from '@/components/Global/InvitesGraph'
import InviteFriendsModal from '@/components/Global/InviteFriendsModal'
import { shortenPoints } from '@/utils/format.utils'
import { profileUrl } from '@/utils/native-routes'
import { Button } from '@/components/0_Bruddle/Button'
import { useCountUp } from '@/hooks/useCountUp'
import { useInView } from 'framer-motion'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import { isIOSNative } from '@/utils/capacitor'
import InviteePointsBadge from '@/components/Points/InviteePointsBadge'

const PointsPage = () => {
    const t = useAppTranslations('rewards')
    const router = useRouter()
    const onBack = useSafeBack('/home')
    const { user, fetchUser } = useAuth()
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
    const inviteesRef = useRef(null)
    const inviteesInView = useInView(inviteesRef, { once: true, margin: '-50px' })

    const getTierBadge = (tier: number) => {
        const badges = [TIER_0_BADGE, TIER_1_BADGE, TIER_2_BADGE, TIER_3_BADGE]
        return badges[tier] || TIER_0_BADGE
    }
    const {
        data: invites,
        isPending: isInvitesPending,
        isError: isInvitesError,
        error: invitesError,
    } = useQuery({
        queryKey: ['invites', user?.user.userId],
        queryFn: () => invitesApi.getInvites(),
        enabled: !!user?.user.userId,
    })

    const {
        data: tierInfo,
        isPending: isTierInfoPending,
        isError: isTierInfoError,
        error: tierInfoError,
    } = useQuery({
        queryKey: ['tierInfo', user?.user.userId],
        queryFn: () => pointsApi.getTierInfo(),
        enabled: !!user?.user.userId,
    })

    // Referral graph is now available for all users
    const { data: myGraphResult } = useQuery({
        queryKey: ['myInviteGraph', user?.user.userId],
        queryFn: () => pointsApi.getUserInvitesGraph(),
        enabled: !!user?.user.userId,
    })

    // Cash status (comprehensive earnings tracking)
    const { data: cashStatus } = useQuery({
        queryKey: ['cashStatus', user?.user.userId],
        queryFn: () => pointsApi.getCashStatus(),
        enabled: !!user?.user.userId,
    })

    const username = user?.user.username

    // animated hero points — remembers last-seen value across visits
    const animatedTotal = useCountUp(tierInfo?.data?.totalPoints ?? 0, {
        storageKey: 'hero_total',
        duration: 1.8,
        enabled: !!tierInfo?.data,
    })

    useEffect(() => {
        posthog.capture(ANALYTICS_EVENTS.POINTS_PAGE_VIEWED)
    }, [])

    useEffect(() => {
        // re-fetch user to get the latest invitees list for showing heart icon
        fetchUser()
    }, [])

    // isPending, not isLoading: both queries wait on `user`, and a disabled query
    // reports isLoading false. isLoading would send the first paint to the error
    // state below, before either request has even started.
    if (isInvitesPending || isTierInfoPending) {
        return <Loading variant="mascot" />
    }

    // getTierInfo catches its own failures and resolves with `data: null`, so the
    // query never reports an error. Past the guard above the request has settled,
    // so missing data means it failed.
    if (isInvitesError || isTierInfoError || !tierInfo?.data) {
        // in the swallowed-error path both error objects are null — log the
        // settled response so the branch never prints a contentless "null"
        console.error(
            'Error loading points data:',
            invitesError ?? tierInfoError ?? { tierInfoSettledWithoutData: tierInfo }
        )

        return (
            <div className="mx-auto space-y-3 mt-6 w-full md:max-w-2xl">
                <EmptyState icon="alert" title={t('loadPointsFailed')} description={t('contactSupport')} />
            </div>
        )
    }

    return (
        <PageContainer className="flex flex-col">
            <NavHeader title={t('title')} onPrev={onBack} />

            <section className="mx-auto space-y-4 mt-10 mb-auto w-full">
                {/* rewards hero — pending claimable as primary, lifetime as secondary */}
                <Card className="flex flex-col gap-4 p-6">
                    {cashStatus?.success &&
                        cashStatus.data &&
                        (() => {
                            const rewards = cashStatus.data.rewards
                            const pendingUsd = rewards?.pendingUsd ?? 0
                            const lifetimeUsd = rewards?.lifetimeEarnedUsd ?? cashStatus.data.lifetimeEarned

                            return (
                                <div className="flex flex-col items-center gap-1">
                                    {pendingUsd > 0 ? (
                                        <>
                                            <p className="text-body-s text-foreground-secondary">{t('youHave')}</p>
                                            <h2 className="text-heading-l text-foreground-primary">
                                                ${pendingUsd.toFixed(2)}
                                            </h2>
                                            <p className="text-center text-body-s text-foreground-secondary">
                                                {t('pendingCallout')}
                                            </p>
                                        </>
                                    ) : (
                                        <p className="text-center text-body-s text-foreground-secondary">
                                            {t('noPendingRewards')}
                                        </p>
                                    )}
                                    <p className="mt-2 text-center text-body-s text-foreground-secondary">
                                        {t('lifetimeRewards', { amount: `$${lifetimeUsd.toFixed(2)}` })}
                                    </p>
                                </div>
                            )
                        })()}

                    <Button
                        variant="purple"
                        shadowSize="4"
                        onClick={() => setIsInviteModalOpen(true)}
                        className="w-full"
                    >
                        {t('inviteNow')}
                    </Button>

                    <div className="border-t border-border-disabled" />

                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-center gap-2">
                            <Image src={STAR_STRAIGHT_ICON} alt={t('starAlt')} width={16} height={16} />
                            <p className="text-body-m text-foreground-secondary">
                                {(() => {
                                    const { number, suffix } = shortenPoints(animatedTotal)
                                    return (
                                        <>
                                            {number}
                                            {suffix && <span>{suffix}</span>}
                                        </>
                                    )
                                })()}{' '}
                                {t('pointsLabel', { count: tierInfo.data.totalPoints })}
                            </p>
                        </div>

                        {/* tier progress - compact */}
                        <div className="flex items-center gap-2">
                            <Image
                                src={getTierBadge(tierInfo?.data.currentTier)}
                                alt={t('tierBadgeAlt', { tier: tierInfo?.data.currentTier })}
                                width={20}
                                height={20}
                            />
                            <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-background-disabled">
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-action-primary to-action-primary-hover transition-all duration-500"
                                    style={{
                                        width: `${
                                            tierInfo?.data.currentTier >= 2
                                                ? 100
                                                : Math.pow(
                                                      Math.min(
                                                          1,
                                                          tierInfo.data.nextTierThreshold > 0
                                                              ? tierInfo.data.totalPoints /
                                                                    tierInfo.data.nextTierThreshold
                                                              : 0
                                                      ),
                                                      0.6
                                                  ) * 100
                                        }%`,
                                    }}
                                />
                            </div>
                            {tierInfo?.data.currentTier < 2 && (
                                <Image
                                    src={getTierBadge(tierInfo?.data.currentTier + 1)}
                                    alt={t('tierBadgeAlt', { tier: tierInfo?.data.currentTier + 1 })}
                                    width={20}
                                    height={20}
                                />
                            )}
                        </div>
                        {tierInfo?.data.currentTier < 2 && (
                            <p className="text-center text-body-xs text-foreground-secondary">
                                {t('pointsToNextTier', { count: tierInfo.data.pointsToNextTier })}
                            </p>
                        )}
                    </div>
                </Card>

                {/* iOS presents the programme as cashback (see useAppTranslations);
                    the explainer is part of that framing, so web and Android skip it */}
                {isIOSNative() && (
                    <Card className="flex flex-col gap-3 p-6">
                        <h2 className="text-body-m font-black">{t('howItWorks.title')}</h2>
                        <ol className="flex flex-col gap-2">
                            {(['step1', 'step2', 'step3', 'step4'] as const).map((step, i) => (
                                <li key={step} className="flex items-start gap-3 text-body-s">
                                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-black bg-action-secondary text-body-xs font-black">
                                        {i + 1}
                                    </span>
                                    <span>{t(`howItWorks.${step}`)}</span>
                                </li>
                            ))}
                        </ol>
                    </Card>
                )}

                {/* invite graph with consolidated explanation */}
                {myGraphResult?.data && (
                    <>
                        {/* only render the graph when there are people to show — a
                            single node is just the user themselves and renders as a
                            giant lone blob (no invites yet) */}
                        {myGraphResult.data.nodes?.length > 1 && (
                            <Card className="!mt-8 overflow-hidden p-0">
                                <InvitesGraph
                                    minimal
                                    data={myGraphResult.data}
                                    height={250}
                                    backgroundColor="#ffffff"
                                    showUsernames
                                />
                            </Card>
                        )}
                        <p className="text-center text-body-s">
                            {user?.invitedBy && (
                                <>
                                    <span
                                        onClick={() => router.push(profileUrl(user.invitedBy!))}
                                        className="inline-flex cursor-pointer items-center gap-1 font-bold"
                                    >
                                        {user.invitedBy} <Icon name="invite-heart" size={14} />
                                    </span>{' '}
                                    {t('invitedYou')}{' '}
                                </>
                            )}
                            <br></br>
                            {t('earnWhenFriendsUse')}
                        </p>
                    </>
                )}

                {/* if user has invites: show button above people list */}
                {invites && invites?.invitees && invites.invitees.length > 0 ? (
                    <>
                        {/* people you invited */}
                        <div
                            className="flex cursor-pointer items-center justify-between"
                            onClick={() => router.push('/rewards/invites')}
                        >
                            <h2 className="text-heading-card text-foreground-primary">{t('peopleYouInvited')}</h2>
                            <NavigationArrow className="text-foreground-primary" />
                        </div>

                        <div ref={inviteesRef}>
                            {invites.invitees?.slice(0, 5).map((invite: PointsInvite, i: number) => {
                                const username = invite.username
                                const fullName = invite.fullName
                                const isVerified = invite.kycVerified
                                const pointsEarned = invite.contributedPoints ?? 0
                                // respect user's showFullName preference for avatar and display name
                                const displayName = invite.showFullName && fullName ? fullName : username
                                return (
                                    <Card
                                        key={invite.inviteeId}
                                        position={getCardPosition(i, Math.min(5, invites.invitees.length))}
                                        onClick={() => router.push(profileUrl(username))}
                                        className="cursor-pointer"
                                    >
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-3">
                                                <TransactionAvatarBadge
                                                    initials={getInitialsFromName(displayName)}
                                                    userName={displayName}
                                                    isLinkTransaction={false}
                                                    transactionType={'send'}
                                                    context="card"
                                                    size="small"
                                                />
                                            </div>
                                            <div className="min-w-0 flex-1 truncate font-roboto text-body-m">
                                                <VerifiedUserLabel
                                                    name={displayName}
                                                    username={username}
                                                    isVerified={isVerified}
                                                />
                                            </div>
                                            <InviteePointsBadge
                                                points={pointsEarned}
                                                inView={inviteesInView}
                                                lifetimeEarnedUsd={invite.lifetimeEarnedUsd}
                                            />
                                        </div>
                                    </Card>
                                )
                            })}
                        </div>
                    </>
                ) : (
                    <>
                        {/* if user has no invites: canonical empty state with modal button */}
                        <EmptyState
                            icon="trophy"
                            title={t('noInvitesYet')}
                            description={t('shareInviteLinkPrompt')}
                            containerClassName="!mt-8"
                            cta={
                                <Button
                                    variant="purple"
                                    shadowSize="4"
                                    size="small"
                                    className="mt-2"
                                    onClick={() => setIsInviteModalOpen(true)}
                                >
                                    {t('shareInviteLink')}
                                </Button>
                            }
                        />
                    </>
                )}

                {/* Invite Modal */}
                <InviteFriendsModal
                    visible={isInviteModalOpen}
                    onClose={() => setIsInviteModalOpen(false)}
                    username={username ?? ''}
                    source="points_page"
                />
            </section>
        </PageContainer>
    )
}

export default PointsPage
