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
import { useEffect } from 'react'

const PointsPage = () => {
    const router = useRouter()
    const { user, fetchUser } = useAuth()
    const { data: invites, isLoading } = useQuery({
        queryKey: ['invites', user?.user.userId],
        queryFn: () => invitesApi.getInvites(),
        enabled: !!user?.user.userId,
    })

    const username = user?.user.username
    const inviteCode = username ? `${username.toUpperCase()}INVITESYOU` : ''
    const inviteLink = `${process.env.NEXT_PUBLIC_BASE_URL}/invite?code=${inviteCode}`

    useEffect(() => {
        // Re-fetch user to get the latest invitees list for showing heart Icon
        fetchUser()
    }, [])

    if (isLoading) {
        return <PeanutLoading coverFullScreen />
    }

    return (
        <PageContainer className="flex flex-col">
            <NavHeader title="Invites" onPrev={() => router.back()} />

            <section className="mx-auto mb-auto mt-10 w-full space-y-4">
                {user?.invitedBy && (
                    <p className="text-sm">
                        <span
                            onClick={() => router.push(`/${user.invitedBy}`)}
                            className="inline-flex cursor-pointer items-center gap-1 font-bold"
                        >
                            {user.invitedBy} <Icon name="invite-heart" size={14} />
                        </span>{' '}
                        invited you and earned points. Now it's your turn! Invite friends and get 20% of their points.
                    </p>
                )}

                <h1 className="font-bold">Invite friends with your code</h1>
                <div className="flex w-full items-center justify-between gap-3">
                    <Card className="flex w-full items-center justify-between py-3.5">
                        <p className="overflow-hidden text-ellipsis whitespace-nowrap text-sm font-bold md:text-base">{`${inviteCode}`}</p>
                        <CopyToClipboard textToCopy={inviteCode} />
                    </Card>
                </div>

                {invites && invites.length > 0 && (
                    <>
                        <ShareButton
                            generateText={() => Promise.resolve(generateInvitesShareText(inviteLink))}
                            title="Share your invite link"
                        >
                            Share Invite link
                        </ShareButton>
                        <h2 className="!mt-8 font-bold">People you invited</h2>
                        <div>
                            {invites?.map((invite: Invite, i: number) => {
                                const username = invite.invitee.username
                                const isVerified = invite.invitee.bridgeKycStatus === 'approved'
                                return (
                                    <Card key={invite.id} position={getCardPosition(i, invites.length)}>
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-3">
                                                <TransactionAvatarBadge
                                                    initials={username}
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
                                        </div>
                                    </Card>
                                )
                            })}
                        </div>
                    </>
                )}
                {invites?.length === 0 && (
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
