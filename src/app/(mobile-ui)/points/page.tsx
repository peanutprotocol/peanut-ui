'use client'

import PageContainer from '@/components/0_Bruddle/PageContainer'
import Card, { getCardPosition } from '@/components/Global/Card'
import CopyToClipboard from '@/components/Global/CopyToClipboard'
import { Icon } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import PeanutLoading from '@/components/Global/PeanutLoading'
import ShareButton from '@/components/Global/ShareButton'
import TransactionAvatarBadge from '@/components/TransactionDetails/TransactionAvatarBadge'
import { VerifiedUserLabel } from '@/components/UserHeader'
import { useAuth } from '@/context/authContext'
import { invitesApi } from '@/services/invites'
import { Invite } from '@/services/services.types'
import { generateInvitesShareText } from '@/utils'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { STAR_STRAIGHT_ICON, TIER_0_BADGE, TIER_1_BADGE, TIER_2_BADGE, TIER_3_BADGE } from '@/assets'
import Image from 'next/image'
import { pointsApi } from '@/services/points'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import { getInitialsFromName } from '@/utils'
import { PointsInvite } from '@/services/services.types'

const PointsPage = () => {
    const router = useRouter()
    const { user } = useAuth()

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
    const username = user?.user.username
    const inviteCode = username ? `${username.toUpperCase()}INVITESYOU` : ''
    const inviteLink = `${process.env.NEXT_PUBLIC_BASE_URL}/invite?code=${inviteCode}`

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
                <Card className="flex flex-col items-center justify-center gap-2 p-4">
                    <h2 className="text-3xl font-extrabold text-black">TIER {tierInfo?.data.currentTier}</h2>
                    <span className="flex items-center gap-2">
                        <Image src={STAR_STRAIGHT_ICON} alt="star" width={20} height={20} />
                        {tierInfo.data.totalPoints} {tierInfo.data.totalPoints === 1 ? 'Point' : 'Points'}
                    </span>
                    {/* Progressive progress bar */}
                    <div className="flex w-full items-center gap-2">
                        <Image
                            src={getTierBadge(tierInfo?.data.currentTier)}
                            alt={`Tier ${tierInfo?.data.currentTier}`}
                            width={26}
                            height={26}
                            className="translate-y-0.5"
                        />
                        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-grey-2">
                            <div
                                className="h-full animate-pulse rounded-full bg-primary-1 transition-all duration-200"
                                style={{
                                    width: `${Math.pow(tierInfo.data.totalPoints / tierInfo.data.nextTierThreshold, 0.6) * 100}%`,
                                }}
                            />
                        </div>
                        <Image
                            src={getTierBadge(tierInfo?.data.currentTier + 1)}
                            alt={`Tier ${tierInfo?.data.currentTier + 1}`}
                            width={26}
                            height={26}
                            className="translate-y-0.5"
                        />
                    </div>

                    <p className="text-sm text-grey-1">
                        {tierInfo.data.pointsToNextTier} {tierInfo.data.pointsToNextTier === 1 ? 'point' : 'points'}{' '}
                        needed for the next tier
                    </p>
                </Card>
                {user?.invitedBy ? (
                    <p className="text-sm">
                        <span
                            onClick={() => router.push(`/${user.invitedBy}`)}
                            className="inline-flex cursor-pointer items-center gap-1 font-bold"
                        >
                            {user.invitedBy} <Icon name="invite-heart" size={14} />
                        </span>{' '}
                        invited you and earned points. Now it's your turn! Invite friends and get 20% of their points.
                    </p>
                ) : (
                    <div className="mx-3 flex items-start gap-2">
                        <Icon name="info" className="size-6 text-black md:size-3" />
                        <p className="text-sm text-black">
                            Do stuff on Peanut and get points. Invite friends and pocket 20% of their points, too.
                        </p>
                    </div>
                )}

                <h1 className="font-bold">Invite friends with your code</h1>
                <div className="flex w-full items-center justify-between gap-3">
                    <Card className="flex w-full items-center justify-between py-3.5">
                        <p className="overflow-hidden text-ellipsis whitespace-nowrap text-sm font-bold md:text-base">{`${inviteCode}`}</p>
                        <CopyToClipboard textToCopy={inviteCode} />
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
                            <Icon name="arrow-up-right" className="text-black" />
                        </div>
                        <div>
                            {invites.invitees?.map((invite: PointsInvite, i: number) => {
                                const username = invite.username
                                const fullName = invite.fullName
                                const isVerified = invite.kycStatus === 'approved'
                                const pointsEarned = Math.floor(invite.totalPoints * 0.2)
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
                                                    initials={getInitialsFromName(fullName ?? username)}
                                                    userName={username}
                                                    isLinkTransaction={false}
                                                    transactionType={'send'}
                                                    context="card"
                                                    size="small"
                                                />
                                            </div>
                                            <div className="min-w-0 flex-1 truncate font-roboto text-[16px] font-medium">
                                                <VerifiedUserLabel
                                                    name={username}
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
