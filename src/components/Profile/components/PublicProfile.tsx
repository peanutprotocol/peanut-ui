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
import { useState, useEffect } from 'react'
import { usersApi } from '@/services/users'
import { useRouter } from 'next/navigation'
import { formatExtendedNumber } from '@/utils'
import Card from '@/components/Global/Card'
import { useAuth } from '@/context/authContext'

interface PublicProfileProps {
    username: string
    isVerified?: boolean
    isLoggedIn?: boolean
    onSendClick?: () => void
}

const PublicProfile: React.FC<PublicProfileProps> = ({
    username,
    isVerified = false,
    isLoggedIn = false,
    onSendClick,
}) => {
    const dispatch = useAppDispatch()
    const [fullName, setFullName] = useState<string>(username)
    const [totalSent, setTotalSent] = useState<string>('0.00')
    const [totalReceived, setTotalReceived] = useState<string>('0.00')
    const { user } = useAuth()
    const router = useRouter()

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
            setTotalSent(user.totalUsdSent)
            setTotalReceived(user.totalUsdReceived)
        })
    }, [username])

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
                    <NavHeader onPrev={router.back} hideLabel />
                )}
            </div>

            <div className="space-y-8">
                {/* Profile Header - Using the reusable component */}
                <ProfileHeader
                    showShareButton={false}
                    name={fullName}
                    username={username}
                    isVerified={isVerified}
                    className="mb-6"
                />

                {/* Action Buttons */}
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

                    <Link href={`/request/${username}`} className="w-1/2">
                        <Button
                            variant="purple"
                            shadowSize="4"
                            className="flex items-center justify-center gap-2 rounded-full py-3"
                        >
                            <div className="flex size-5 items-center justify-center">
                                <Icon name="arrow-down-left" size={8} fill="black" />
                            </div>
                            <span className="font-bold">Request</span>
                        </Button>
                    </Link>
                </div>

                {!!user && totalSent !== '0.00' && totalReceived !== '0.00' && (
                    <div className="space-y-6">
                        <div>
                            <Card position="first">
                                <div className="flex items-center justify-between py-2">
                                    <span className="font-medium">Total sent to</span>
                                    <span className="font-medium">${formatExtendedNumber(totalSent)}</span>
                                </div>
                            </Card>
                            <Card position="last">
                                <div className="flex items-center justify-between py-2">
                                    <span className="font-medium">Total received from</span>
                                    <span className="font-medium">${formatExtendedNumber(totalReceived)}</span>
                                </div>
                            </Card>
                        </div>
                    </div>
                )}

                {/*
                {!hasTransactions && (
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
                                        <h2 className="text-lg font-extrabold">Join Peanut!</h2>
                                        <p>Send and receive payments in seconds with your own Peanut account.</p>
                                    </div>
                                    <Button
                                        variant="purple"
                                        shadowSize="4"
                                        className="mt-1 flex w-full items-center justify-center gap-2 rounded-sm"
                                        onClick={() => router.push('/setup')}
                                    >
                                        <Icon name="user-plus" size={16} fill="black" />
                                        <span className="font-bold">Create Account</span>
                                    </Button>
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
                */}
                <HomeHistory isPublic={true} username={username} />
            </div>
        </div>
    )
}

export default PublicProfile
