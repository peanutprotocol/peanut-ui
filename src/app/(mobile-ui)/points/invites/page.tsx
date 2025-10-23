'use client'

import PageContainer from '@/components/0_Bruddle/PageContainer'
import Card, { getCardPosition } from '@/components/Global/Card'
import NavHeader from '@/components/Global/NavHeader'
import PeanutLoading from '@/components/Global/PeanutLoading'
import TransactionAvatarBadge from '@/components/TransactionDetails/TransactionAvatarBadge'
import { VerifiedUserLabel } from '@/components/UserHeader'
import { useAuth } from '@/context/authContext'
import { invitesApi } from '@/services/invites'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { STAR_STRAIGHT_ICON } from '@/assets'
import Image from 'next/image'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import { getInitialsFromName } from '@/utils'
import { type PointsInvite } from '@/services/services.types'

const InvitesPage = () => {
    const router = useRouter()
    const { user } = useAuth()

    const {
        data: invites,
        isLoading,
        isError,
        error,
    } = useQuery({
        queryKey: ['invites', user?.user.userId],
        queryFn: () => invitesApi.getInvites(),
        enabled: !!user?.user.userId,
    })

    if (isLoading) {
        return <PeanutLoading />
    }

    if (isError) {
        console.error('Error loading invites:', error)
        return (
            <div className="mx-auto mt-6 w-full space-y-3 md:max-w-2xl">
                <EmptyState icon="alert" title="Error loading invites!" description="Please contact Support." />
            </div>
        )
    }

    // Calculate total points earned (20% of each invitee's points)
    const totalPointsEarned =
        invites?.invitees?.reduce((sum: number, invite: PointsInvite) => {
            return sum + Math.floor(invite.totalPoints * 0.2)
        }, 0) || 0

    return (
        <PageContainer className="flex flex-col">
            <NavHeader title="Points" onPrev={() => router.back()} />

            <section className="mx-auto mb-auto mt-10 w-full space-y-4">
                {/* Summary Card */}
                <Card className="flex flex-col items-center justify-center gap-2 p-4">
                    <h2 className="text-center font-medium text-black">Your friends earned you</h2>
                    <span className="flex items-center gap-2">
                        <Image src={STAR_STRAIGHT_ICON} alt="star" width={20} height={20} />
                        <span className="text-3xl font-extrabold text-black">
                            {totalPointsEarned} {totalPointsEarned === 1 ? 'Point' : 'Points'}
                        </span>
                    </span>
                </Card>

                <h2 className="font-bold">People you invited</h2>

                {/* Full list */}
                <div>
                    {invites?.invitees?.map((invite: PointsInvite, i: number) => {
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
            </section>
        </PageContainer>
    )
}

export default InvitesPage
