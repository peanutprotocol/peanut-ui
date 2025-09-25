'use client'

import { PEANUT_LOGO_BLACK, PEANUTMAN_LOGO } from '@/assets'
import { Button } from '@/components/0_Bruddle'
import { Icon } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import HomeHistory from '@/components/Home/HomeHistory'
import { useAppDispatch } from '@/redux/hooks'
import { paymentActions } from '@/redux/slices/payment-slice'
import Image from 'next/image'
import Link from 'next/link'
import ProfileHeader from './ProfileHeader'
import { useState, useEffect, useMemo } from 'react'
import { usersApi } from '@/services/users'
import { useRouter } from 'next/navigation'
import Card from '@/components/Global/Card'
import chillPeanutAnim from '@/animations/GIF_ALPHA_BACKGORUND/512X512_ALPHA_GIF_konradurban_01.gif'
import { checkIfInternalNavigation } from '@/utils'
import { useAuth } from '@/context/authContext'
import ShareButton from '@/components/Global/ShareButton'
import ActionModal from '@/components/Global/ActionModal'

interface PublicProfileProps {
    username: string
    isLoggedIn?: boolean
    onSendClick?: () => void
}

const PublicProfile: React.FC<PublicProfileProps> = ({ username, isLoggedIn = false, onSendClick }) => {
    const dispatch = useAppDispatch()
    const [totalSentByLoggedInUser, setTotalSentByLoggedInUser] = useState<string>('0')
    const [fullName, setFullName] = useState<string>(username)
    const [isKycVerified, setIsKycVerified] = useState<boolean>(false)
    const router = useRouter()
    const { user } = useAuth()
    const isSelfProfile = user?.user.username?.toLowerCase() === username.toLowerCase()
    const [showInviteModal, setShowInviteModal] = useState(false)
    // Handle send button click
    const handleSend = () => {
        if (onSendClick) {
            onSendClick()
        } else {
            dispatch(paymentActions.setView('INITIAL'))
        }
    }

    useEffect(() => {
        usersApi.getByUsername(username).then((user) => {
            if (user?.fullName) setFullName(user.fullName)
            if (user?.bridgeKycStatus === 'approved') setIsKycVerified(true)
            // to check if the logged in user has sent money to the profile user,
            // we check the amount that the profile user has received from the logged in user.
            if (user?.totalUsdReceivedFromCurrentUser) {
                setTotalSentByLoggedInUser(user.totalUsdReceivedFromCurrentUser)
            }
        })
    }, [username])

    // this flag is true if the current user has sent money to the profile user before.
    const haveSentMoneyToUser = useMemo(() => Number(totalSentByLoggedInUser) > 0, [totalSentByLoggedInUser])

    return (
        <div className="flex h-full w-full flex-col space-y-4 bg-background">
            {/* Logo - Only shown in guest view */}
            <div>
                {!isLoggedIn ? (
                    <div className="flex items-center gap-2 md:hidden">
                        <Image src={PEANUTMAN_LOGO} alt="Peanut Logo" height={24} />
                        <Image src={PEANUT_LOGO_BLACK} alt="Peanut Text" height={12} />
                    </div>
                ) : (
                    <NavHeader
                        onPrev={() => {
                            // Check if the referrer is from the same domain (internal navigation)
                            const isInternalReferrer = checkIfInternalNavigation()

                            if (isInternalReferrer && window.history.length > 1) {
                                router.back()
                            } else {
                                router.push('/home')
                            }
                        }}
                        hideLabel
                    />
                )}
            </div>

            <div className="space-y-8">
                {/* Profile Header - Using the reusable component */}
                <ProfileHeader
                    showShareButton={false}
                    name={fullName}
                    username={username}
                    isVerified={isKycVerified}
                    className="mb-6"
                    haveSentMoneyToUser={haveSentMoneyToUser}
                />

                {/* Action Buttons */}
                {!isSelfProfile && (
                    <div className="flex items-center justify-normal gap-4">
                        <Button
                            onClick={handleSend}
                            variant="purple"
                            shadowSize="4"
                            className="flex w-1/2 items-center justify-center gap-2 rounded-full py-3"
                        >
                            <div className="flex size-5 items-center justify-center">
                                <Icon name="arrow-up-right" size={8} fill="black" />
                            </div>
                            <span className="font-bold">Send</span>
                        </Button>

                        <Button
                            onClick={() => setShowInviteModal(true)}
                            variant="purple"
                            shadowSize="4"
                            className="flex w-1/2 items-center justify-center gap-2 rounded-full py-3"
                        >
                            <div className="flex size-5 items-center justify-center">
                                <Icon name="arrow-down-left" size={8} fill="black" />
                            </div>
                            <span className="font-bold">Request</span>
                        </Button>
                    </div>
                )}

                {/* Show create account box to guest users */}
                {!isLoggedIn && (
                    <div className="relative flex flex-col items-center">
                        <Card position="single" className="z-10 mt-28 space-y-2 p-4 text-center">
                            {isLoggedIn ? (
                                <>
                                    <h2 className="text-lg font-extrabold">You're all set</h2>
                                    <p className="mx-auto max-w-[55%] text-sm">
                                        Now send or request money to get started.
                                    </p>
                                </>
                            ) : (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <h2 className="text-lg font-extrabold">No invite, no Peanut</h2>
                                        <p>
                                            Peanut is invite-only.
                                            <br />
                                            Go beg your friend for an invite link!
                                        </p>
                                    </div>
                                    <ShareButton
                                        generateText={() =>
                                            Promise.resolve(
                                                `Bro… I’m on my knees. Peanut is invite-only and I’m locked outside. Save my life and send me your invite`
                                            )
                                        }
                                        title="Beg for an invite"
                                    >
                                        Beg for an invite
                                    </ShareButton>
                                </div>
                            )}
                        </Card>
                        <div
                            className="absolute left-0 top-0 flex w-full justify-center"
                            style={{ transform: 'translateY(-15%)' }}
                        >
                            <div className="relative h-42 w-[65%] md:h-44 md:w-[45%]">
                                <Image
                                    src={chillPeanutAnim.src}
                                    alt="Peanut Mascot"
                                    width={120}
                                    height={120}
                                    className="h-auto w-auto"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Show history to logged in users  */}
                {isLoggedIn && <HomeHistory isPublic={false} username={username} />}

                <ActionModal
                    icon="user"
                    title="No invite, no Peanut"
                    description={`Peanut is invite-only.\nGo beg your friend for an invite link!`}
                    visible={showInviteModal}
                    onClose={() => {
                        setShowInviteModal(false)
                    }}
                    content={
                        <ShareButton
                            generateText={() =>
                                Promise.resolve(
                                    `Bro… I’m on my knees. Peanut is invite-only and I’m locked outside. Save my life and send me your invite`
                                )
                            }
                            title="Beg for an invite"
                        >
                            Beg for an invite
                        </ShareButton>
                    }
                />
            </div>
        </div>
    )
}

export default PublicProfile
