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
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'

const PointsPage = () => {
    const router = useRouter()
    const { user } = useAuth()
    const { data: invites, isLoading } = useQuery({
        queryKey: ['invites', user?.user.userId],
        queryFn: () => invitesApi.getInvites(),
        enabled: !!user?.user.userId,
    })

    const username = user?.user.username
    const inviteCode = username ? `${username.toUpperCase()}INVITESYOU` : ''
    const inviteLink = `${process.env.NEXT_PUBLIC_BASE_URL}/invite?code=${inviteCode}`

    if (isLoading) {
        return <PeanutLoading coverFullScreen />
    }

    return (
        <PageContainer className="flex flex-col">
            <NavHeader title="Invites" onPrev={() => router.back()} />

            <section className="mx-auto mb-auto mt-10 w-full space-y-4">
                <h1 className="font-bold">Refer friends</h1>
                <div className="flex w-full items-center justify-between gap-3">
                    <Card className="flex w-1/2 items-center justify-center py-3.5">
                        <p className="overflow-hidden text-ellipsis whitespace-nowrap text-sm font-bold md:text-base">{`${inviteCode}`}</p>
                    </Card>

                    <CopyToClipboard type="button" textToCopy={inviteCode} />
                </div>

                {invites?.length && invites.length > 0 && (
                    <>
                        <ShareButton
                            generateText={() =>
                                Promise.resolve(
                                    `I’m using Peanut, an invite-only app for easy payments. With it you can pay friends, use merchants, and move money in and out of your bank, even cross-border. Here’s my invite: ${inviteLink}`
                                )
                            }
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
                                                <VerifiedUserLabel name={username} isVerified={isVerified} />
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
                        <h2 className="font-medium">No points yet</h2>

                        <p className="text-center text-sm text-grey-1">
                            Earn points for every action you take on Peanut and when your invites create an account.
                        </p>
                        <ShareButton
                            generateText={() =>
                                Promise.resolve(
                                    `I’m using Peanut, an invite-only app for easy payments. With it you can pay friends, use merchants, and move money in and out of your bank, even cross-border. Here’s my invite: ${inviteLink}`
                                )
                            }
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
