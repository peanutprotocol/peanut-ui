'use client'

import PageContainer from '@/components/0_Bruddle/PageContainer'
import Card, { getCardPosition } from '@/components/Global/Card'
import CopyToClipboard from '@/components/Global/CopyToClipboard'
import { Icon } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import NavigationArrow from '@/components/Global/NavigationArrow'
import PeanutLoading from '@/components/Global/PeanutLoading'
import ShareButton from '@/components/Global/ShareButton'
import TransactionAvatarBadge from '@/components/TransactionDetails/TransactionAvatarBadge'
import { VerifiedUserLabel } from '@/components/UserHeader'
import { useAuth } from '@/context/authContext'
import { invitesApi } from '@/services/invites'
import { generateInviteCodeLink, generateInvitesShareText } from '@/utils'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { STAR_STRAIGHT_ICON, TIER_0_BADGE, TIER_1_BADGE, TIER_2_BADGE, TIER_3_BADGE } from '@/assets'
import Image from 'next/image'
import { pointsApi } from '@/services/points'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import { getInitialsFromName } from '@/utils'
import type { PointsInvite } from '@/services/services.types'
import { useEffect } from 'react'
import InvitesGraph from '@/components/Global/InvitesGraph'

const PointsPage = () => {
    const router = useRouter()
    const { user, fetchUser } = useAuth()

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

    const { data: myGraphResult } = useQuery({
        queryKey: ['myInviteGraph', user?.user.userId],
        queryFn: () => pointsApi.getInvitesGraph(''),
        enabled:
            !!user?.user.userId && user?.user?.badges?.some((badge) => badge.code === 'SEEDLING_DEVCONNECT_BA_2025'),
    })
    const username = user?.user.username
    const { inviteCode, inviteLink } = generateInviteCodeLink(username ?? '')

    useEffect(() => {
        // Re-fetch user to get the latest invitees list for showing heart Icon
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
            <NavHeader title="Points" onPrev={() => router.back()} />

            <section className="mx-auto mb-auto mt-10 w-full space-y-4">
                <Card className="flex flex-col items-center justify-center gap-3 p-6">
                    <div className="flex items-center gap-2">
                        <Image src={STAR_STRAIGHT_ICON} alt="star" width={24} height={24} />
                        <h2 className="text-4xl font-black text-black">
                            {tierInfo.data.totalPoints} {tierInfo.data.totalPoints === 1 ? 'Point' : 'Points'}
                        </h2>
                    </div>

                    {/* Progressive progress bar */}
                    <div className="flex w-full items-center gap-3">
                        <Image
                            src={getTierBadge(tierInfo?.data.currentTier)}
                            alt={`Tier ${tierInfo?.data.currentTier}`}
                            width={32}
                            height={32}
                        />
                        <div className="relative h-2 w-full overflow-hidden rounded-full bg-grey-2">
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
                                                          ? tierInfo.data.totalPoints / tierInfo.data.nextTierThreshold
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
                                width={32}
                                height={32}
                            />
                        )}
                    </div>

                    <div className="text-center">
                        <p className="text-base text-grey-1">You&apos;re at tier {tierInfo?.data.currentTier}.</p>
                        {tierInfo?.data.currentTier < 2 ? (
                            <p className="text-sm text-grey-1">
                                {tierInfo.data.pointsToNextTier}{' '}
                                {tierInfo.data.pointsToNextTier === 1 ? 'point' : 'points'} needed to level up
                            </p>
                        ) : (
                            <p className="text-sm text-grey-1">You&apos;ve reached the max tier!</p>
                        )}
                    </div>
                </Card>
                {user?.invitedBy ? (
                    <p className="text-center text-sm">
                        <span
                            onClick={() => router.push(`/${user.invitedBy}`)}
                            className="inline-flex cursor-pointer items-center gap-1 font-bold"
                        >
                            {user.invitedBy} <Icon name="invite-heart" size={14} />
                        </span>{' '}
                        invited you and earned points. Now it's your turn! Invite friends and get 20% of their points.
                    </p>
                ) : (
                    <div className="mx-3 flex items-center gap-2">
                        <Icon name="info" className="size-4 flex-shrink-0 text-black" />
                        <p className="text-sm text-black">
                            Do stuff on Peanut and get points. Invite friends and pocket 20% of their points, too.
                        </p>
                    </div>
                )}

                <h1 className="font-bold">Invite friends with your code</h1>
                <div className="flex w-full items-center justify-between gap-3">
                    <Card className="flex w-full items-center justify-between py-3.5">
                        <p className="overflow-hidden text-ellipsis whitespace-nowrap text-sm font-bold md:text-base">{`${inviteCode}`}</p>
                        <CopyToClipboard textToCopy={inviteCode} iconSize="4" />
                    </Card>
                </div>

                {invites && invites?.invitees && invites.invitees.length > 0 && (
                    <>
                        <ShareButton
                            generateText={() => Promise.resolve(generateInvitesShareText(inviteLink))}
                            title="Share your invite link"
                        >
                            Share Invite link
                        </ShareButton>
                        <div
                            className="!mt-8 flex cursor-pointer items-center justify-between"
                            onClick={() => router.push('/points/invites')}
                        >
                            <h2 className="font-bold">People you invited</h2>
                            <NavigationArrow className="text-black" />
                        </div>

                        {/* Invite Graph */}
                        {myGraphResult?.data && (
                            <>
                                <Card className="overflow-hidden p-0">
                                    <InvitesGraph
                                        minimal
                                        data={myGraphResult.data}
                                        height={250}
                                        backgroundColor="#ffffff"
                                        showUsernames
                                    />
                                </Card>
                                <div className="flex items-center gap-2">
                                    <Icon name="info" className="size-4 flex-shrink-0 text-black" />
                                    <p className="text-sm text-black">
                                        Experimental. Only availabe for Seedlings badge holders.
                                    </p>
                                </div>
                            </>
                        )}

                        <div>
                            {invites.invitees?.map((invite: PointsInvite, i: number) => {
                                const username = invite.username
                                const fullName = invite.fullName
                                const isVerified = invite.kycStatus === 'approved'
                                const pointsEarned = Math.floor(invite.totalPoints * 0.2)
                                // respect user's showFullName preference for avatar and display name
                                const displayName = invite.showFullName && fullName ? fullName : username
                                return (
                                    <Card
                                        key={invite.inviteeId}
                                        position={getCardPosition(i, invites.invitees.length)}
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
                                            <p className="text-grey-1">
                                                +{pointsEarned} {pointsEarned === 1 ? 'pt' : 'pts'}
                                            </p>
                                        </div>
                                    </Card>
                                )
                            })}
                        </div>
                    </>
                )}

                {invites?.invitees?.length === 0 && (
                    <Card className="flex flex-col items-center justify-center gap-4 py-4">
                        <div className="flex items-center justify-center rounded-full bg-primary-1 p-2">
                            <Icon name="trophy" />
                        </div>
                        <h2 className="font-medium">No invites yet</h2>

                        <p className="text-center text-sm text-grey-1">
                            Send your invite link to start earning more rewards
                        </p>
                        <ShareButton
                            generateText={() => Promise.resolve(generateInvitesShareText(inviteLink))}
                            title="Share your invite link"
                        >
                            Share Invite link
                        </ShareButton>
                    </Card>
                )}
            </section>
        </PageContainer>
    )
}

export default PointsPage
