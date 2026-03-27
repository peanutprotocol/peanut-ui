'use client'

import PageContainer from '@/components/0_Bruddle/PageContainer'
import Card from '@/components/Global/Card'
import { getCardPosition } from '@/components/Global/Card/card.utils'
import { Icon } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import NavigationArrow from '@/components/Global/NavigationArrow'
import PeanutLoading from '@/components/Global/PeanutLoading'
import TransactionAvatarBadge from '@/components/TransactionDetails/TransactionAvatarBadge'
import { VerifiedUserLabel } from '@/components/UserHeader'
import { useAuth } from '@/context/authContext'
import { invitesApi } from '@/services/invites'
import { getInitialsFromName } from '@/utils/general.utils'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { STAR_STRAIGHT_ICON, TIER_0_BADGE, TIER_1_BADGE, TIER_2_BADGE, TIER_3_BADGE } from '@/assets'
import Image from 'next/image'
import { pointsApi } from '@/services/points'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import { type PointsInvite } from '@/services/services.types'
import { useEffect, useRef, useState } from 'react'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import InvitesGraph from '@/components/Global/InvitesGraph'
import InviteFriendsModal from '@/components/Global/InviteFriendsModal'
import { formatPoints, shortenPoints } from '@/utils/format.utils'
import { Button } from '@/components/0_Bruddle/Button'
import { useCountUp } from '@/hooks/useCountUp'
import { useInView } from 'framer-motion'
import InviteePointsBadge from '@/components/Points/InviteePointsBadge'

const PointsPage = () => {
    const router = useRouter()
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
        isLoading,
        isError: isInvitesError,
        error: invitesError,
    } = useQuery({
        queryKey: ['invites', user?.user.userId],
        queryFn: () => invitesApi.getInvites(),
        enabled: !!user?.user.userId,
    })

    const {
        data: tierInfo,
        isLoading: isTierInfoLoading,
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

    if (isLoading || isTierInfoLoading || !tierInfo?.data) {
        return <PeanutLoading />
    }

    if (isInvitesError || isTierInfoError) {
        console.error('Error loading points data:', invitesError ?? tierInfoError)

        return (
            <div className="mx-auto mt-6 w-full space-y-3 md:max-w-2xl">
                <EmptyState icon="alert" title="Error loading points!" description="Please contact Support." />
            </div>
        )
    }

    return (
        <PageContainer className="flex flex-col">
            <NavHeader title="Rewards" onPrev={() => router.back()} />

            <section className="mx-auto mb-auto mt-10 w-full space-y-4">
                {/* rewards hero — $ amount is primary, points de-emphasized */}
                <Card className="flex flex-col gap-4 p-6">
                    {cashStatus?.success && cashStatus.data && (
                        <div className="flex flex-col items-center gap-3">
                            {cashStatus.data.rewards ? (
                                <>
                                    <p className="text-sm text-grey-1">Lifetime rewards earned</p>
                                    <h2 className="text-4xl font-black text-black">
                                        ${cashStatus.data.rewards.lifetimeEarnedUsd.toFixed(2)}
                                    </h2>
                                    {cashStatus.data.rewards.pendingUsd > 0 && (
                                        <p className="text-center text-sm text-grey-1">
                                            You have ${cashStatus.data.rewards.pendingUsd.toFixed(2)} in pending
                                            rewards. Make a payment to claim.
                                        </p>
                                    )}
                                </>
                            ) : (
                                <>
                                    <p className="text-sm text-grey-1">Lifetime cashback claimed</p>
                                    <h2 className="text-4xl font-black text-black">
                                        ${cashStatus.data.lifetimeEarned.toFixed(2)}
                                    </h2>
                                </>
                            )}
                        </div>
                    )}

                    <div className="flex flex-col items-center gap-2">
                        <p className="text-sm text-grey-1">Invite friends to earn more rewards</p>
                        <Button
                            variant="purple"
                            shadowSize="4"
                            onClick={() => setIsInviteModalOpen(true)}
                            className="w-full"
                        >
                            Invite Now
                        </Button>
                    </div>

                    <div className="border-t border-grey-2" />

                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-center gap-2">
                            <Image src={STAR_STRAIGHT_ICON} alt="star" width={16} height={16} />
                            <p className="text-base font-medium text-grey-1">
                                {(() => {
                                    const { number, suffix } = shortenPoints(animatedTotal)
                                    return (
                                        <>
                                            {number}
                                            {suffix && <span>{suffix}</span>}
                                        </>
                                    )
                                })()}{' '}
                                {tierInfo.data.totalPoints === 1 ? 'point' : 'points'}
                            </p>
                        </div>

                        {/* tier progress - compact */}
                        <div className="flex items-center gap-2">
                            <Image
                                src={getTierBadge(tierInfo?.data.currentTier)}
                                alt={`Tier ${tierInfo?.data.currentTier}`}
                                width={20}
                                height={20}
                            />
                            <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-grey-2">
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-primary-1 to-primary-2 transition-all duration-500"
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
                                    alt={`Tier ${tierInfo?.data.currentTier + 1}`}
                                    width={20}
                                    height={20}
                                />
                            )}
                        </div>
                        {tierInfo?.data.currentTier < 2 && (
                            <p className="text-center text-xs text-grey-1">
                                {formatPoints(tierInfo.data.pointsToNextTier)}{' '}
                                {tierInfo.data.pointsToNextTier === 1 ? 'point' : 'points'} to next tier
                            </p>
                        )}
                    </div>
                </Card>

                {/* invite graph with consolidated explanation */}
                {myGraphResult?.data && (
                    <>
                        <Card className="!mt-8 overflow-hidden p-0">
                            <InvitesGraph
                                minimal
                                data={myGraphResult.data}
                                height={250}
                                backgroundColor="#ffffff"
                                showUsernames
                            />
                        </Card>
                        <p className="text-center text-sm">
                            {user?.invitedBy && (
                                <>
                                    <span
                                        onClick={() => router.push(`/${user.invitedBy}`)}
                                        className="inline-flex cursor-pointer items-center gap-1 font-bold"
                                    >
                                        {user.invitedBy} <Icon name="invite-heart" size={14} />
                                    </span>{' '}
                                    invited you.{' '}
                                </>
                            )}
                            <br></br>You earn rewards whenever your friends use Peanut!
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
                            <h2 className="font-bold">People you invited</h2>
                            <NavigationArrow className="text-black" />
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
                                        onClick={() => router.push(`/${username}`)}
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
                                            <div className="min-w-0 flex-1 truncate font-roboto text-[16px] font-medium">
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
                        {/* if user has no invites: show empty state with modal button */}
                        <Card className="!mt-8 flex flex-col items-center justify-center gap-4 py-4">
                            <div className="flex items-center justify-center rounded-full bg-primary-1 p-2">
                                <Icon name="trophy" />
                            </div>
                            <h2 className="font-medium">No invites yet</h2>

                            <p className="text-center text-sm text-grey-1">
                                Send your invite link to start earning more rewards
                            </p>
                            <Button
                                variant="purple"
                                shadowSize="4"
                                onClick={() => setIsInviteModalOpen(true)}
                                className="w-full"
                            >
                                Share Invite link
                            </Button>
                        </Card>
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
