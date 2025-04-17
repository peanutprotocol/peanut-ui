'use client'

import chillPeanutAnim from '@/animations/GIF_ALPHA_BACKGORUND/512X512_ALPHA_GIF_konradurban_01.gif'
import { PEANUT_LOGO_BLACK, PEANUTMAN_LOGO } from '@/assets'
// import { PeanutLogo, PeanutMascot } from '@/assets'
import { Button } from '@/components/0_Bruddle'
import Card from '@/components/Global/Card'
import { Icon } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import TransactionCard from '@/components/Home/TransactionCard'
import { useAppDispatch } from '@/redux/hooks'
import { paymentActions } from '@/redux/slices/payment-slice'
import { formatExtendedNumber } from '@/utils'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ProfileHeader from './ProfileHeader'

interface PublicProfileProps {
    username: string
    fullName: string
    initials: string
    isVerified?: boolean
    isLoggedIn?: boolean
    transactions?: {
        sent: number
        received: number
    }
    onSendClick?: () => void
}

const PublicProfile: React.FC<PublicProfileProps> = ({
    username,
    fullName,
    initials,
    isVerified = false,
    isLoggedIn = false,
    transactions,
    onSendClick,
}) => {
    const router = useRouter()
    const dispatch = useAppDispatch()

    // check if user has transaction history
    const hasTransactions = transactions && (transactions.sent > 0 || transactions.received > 0)

    // Handle send button click
    const handleSend = () => {
        if (onSendClick) {
            onSendClick()
        } else {
            console.log('Send button clicked')
            dispatch(paymentActions.setView('INITIAL'))
        }
    }

    return (
        <div className="flex h-full w-full flex-col space-y-4 bg-background">
            {/* Logo - Only shown in guest view */}
            <div>
                {!isLoggedIn ? (
                    <div className="flex items-center gap-2">
                        <Image src={PEANUTMAN_LOGO} alt="Peanut Logo" height={24} />
                        <Image src={PEANUT_LOGO_BLACK} alt="Peanut Text" height={12} />
                    </div>
                ) : (
                    <NavHeader hideLabel />
                )}
            </div>

            <div className="space-y-8">
                {/* Profile Header - Using the reusable component */}
                <ProfileHeader
                    name={fullName}
                    username={username}
                    initials={initials}
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

                    {/* todo: fix href */}
                    <Link href={`/request/create?from=${username}`} className="w-1/2">
                        <Button
                            disabled
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

                <div className="space-y-6">
                    {/* Transaction Summary - Only shown if user has transactions */}
                    {!!hasTransactions && (
                        <div>
                            <Card position="first">
                                <div className="flex items-center justify-between py-2">
                                    <span className="font-medium">Total sent to</span>
                                    <span className="font-medium">
                                        ${formatExtendedNumber(transactions?.sent || 0)}
                                    </span>
                                </div>
                            </Card>
                            <Card position="last">
                                <div className="flex items-center justify-between py-2">
                                    <span className="font-medium">Total received from</span>
                                    <span className="font-medium">
                                        ${formatExtendedNumber(transactions?.received || 0)}
                                    </span>
                                </div>
                            </Card>
                        </div>
                    )}

                    {/* Transactions List - Only shown if user has transactions */}
                    {!!hasTransactions && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-bold">Transactions</h2>
                                {/* todo: fix href */}
                                <Link href={`/transactions?user=${username}`}>
                                    <div className="flex items-center">
                                        <Icon name="chevron-up" size={16} fill="black" className="rotate-90" />
                                    </div>
                                </Link>
                            </div>

                            {/* Example transaction - todo: replace with actual transaction data */}
                            <div>
                                <TransactionCard
                                    type="send"
                                    name="Hugo Montenegro"
                                    amount={BigInt(6969000000)}
                                    initials="HM"
                                    position="first"
                                />

                                <TransactionCard
                                    type="withdraw"
                                    name="Bank Account #1"
                                    amount={BigInt(6969000000)}
                                    position="middle"
                                />

                                <TransactionCard
                                    type="add"
                                    name="peanut.ens"
                                    amount={BigInt(6969000000)}
                                    position="middle"
                                />

                                <TransactionCard
                                    type="request"
                                    name="dasdasdasdsa Montenegro"
                                    amount={BigInt(6969000000)}
                                    initials="HM"
                                    position="last"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Empty State - Only shown if user has no transactions */}
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
                            <div className="relative h-42 w-[65%] md:h-44">
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
            </div>
        </div>
    )
}

export default PublicProfile
