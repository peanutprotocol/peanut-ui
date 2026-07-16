'use client'

import StatusBadge, { type StatusType } from '@/components/Global/Badges/StatusBadge'
import TransactionAvatarBadge from '@/components/TransactionDetails/TransactionAvatarBadge'
import { type TransactionDirection, type TransactionType } from '@/components/TransactionDetails/transaction-types'
import { printableUserHandle } from '@/utils/general.utils'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import React from 'react'
import Card from '../Global/Card'
import { Icon, type IconName } from '../Global/Icons/Icon'
import { VerifiedUserLabel } from '../UserHeader'
import ProgressBar from '../Global/ProgressBar'
import { useRouter } from 'next/navigation'
import { twMerge } from 'tailwind-merge'
import { PEANUTMAN } from '@/assets/mascot'
import { profileUrl } from '@/utils/native-routes'

interface TransactionDetailsHeaderCardProps {
    direction: TransactionDirection
    userName: string
    amountDisplay: string
    initials: string
    status?: StatusType
    isVerified?: boolean
    isLinkTransaction?: boolean
    transactionType?: TransactionType
    avatarUrl?: string
    haveSentMoneyToUser?: boolean
    isAvatarClickable?: boolean
    showProgessBar?: boolean
    progress?: number
    goal?: number
    isRequestPotTransaction?: boolean
    isTransactionClosed: boolean
    convertedAmount?: string
    showFullName?: boolean
    fullName?: string
    countryCode?: string | null
}

type TransactionTranslator = ReturnType<typeof useTranslations<'transaction'>>

const getTitle = (
    t: TransactionTranslator,
    direction: TransactionDirection,
    userName: string,
    isLinkTransaction?: boolean,
    status?: StatusType
): React.ReactNode => {
    let titleText = userName

    // Link transactions short-circuit; userName is already a self-describing
    // label so the "Sent to ${displayName}" prefix doesn't apply.
    if (isLinkTransaction) {
        const completed = status === 'completed'
        const titleByDirection: Partial<Record<TransactionDirection, string>> = {
            send: completed ? t('title.sentViaLink') : userName,
            receive: completed ? t('title.receivedViaLink') : userName,
            request_sent: t('title.requestedViaLink'),
            request_received: t('title.requestViaLink'),
        }
        titleText = titleByDirection[direction] ?? userName ?? t('title.linkTransaction')
    } else {
        // Shorten crypto addresses AND raw UUIDs (usernameless Peanut users
        // whose `identifier` arrives as a userId) so the header never renders
        // a 36-char string.
        const displayName = printableUserHandle(userName)

        // check if this is a test transaction (setup confirmation)
        // note: bad check, but its a quick fix for now - kush (18 nov 2025), to be handled in the backend post devconnect.
        const isTestTransaction = displayName === 'Enjoy Peanut!'

        switch (direction) {
            case 'send':
                if (status === 'pending' || status === 'cancelled') {
                    titleText = displayName
                } else {
                    if (displayName === "You're sending via link") {
                        titleText = t('title.sentViaLink')
                    } else {
                        titleText = t(status === 'completed' ? 'title.sentTo' : 'title.sendingTo', {
                            name: displayName,
                        })
                    }
                }
                break
            case 'request_received':
                titleText = t('title.isRequesting', { name: displayName })
                break
            case 'receive':
                if (displayName === 'Received via Link') {
                    titleText = t('title.receivedViaLink')
                } else {
                    titleText = t('title.receivedFrom', { name: displayName })
                }
                break
            case 'request_sent':
                titleText = t(status === 'completed' ? 'title.requestedFrom' : 'title.requestingFrom', {
                    name: displayName,
                })
                break
            case 'withdraw':
            case 'bank_withdraw':
                titleText = t(status === 'completed' ? 'title.withdrewTo' : 'title.withdrawingTo', {
                    name: displayName,
                })
                break
            case 'bank_claim':
                titleText = displayName
                break
            case 'add':
            case 'bank_deposit':
                if (isTestTransaction) {
                    titleText = 'Enjoy Peanut!'
                } else {
                    titleText = t(status === 'completed' ? 'title.addedFrom' : 'title.addingFrom', {
                        name: displayName,
                    })
                }
                break
            case 'claim_external':
                if (status === 'completed') {
                    titleText = t('title.claimedTo', { name: displayName })
                } else if (status === 'failed') {
                    titleText = t('title.claimTo', { name: displayName })
                } else {
                    titleText = t('title.claimingTo', { name: displayName })
                }
                break
            case 'qr_payment':
                if (status === 'completed') {
                    titleText = t('title.paidTo', { name: displayName })
                } else if (status === 'failed') {
                    // Failed QR-pays carry a self-contained label from the
                    // transformer ("Failed QR payment attempt") — no "Payment to"
                    // prefix, which would read "Payment to Failed QR payment attempt".
                    titleText = displayName
                } else {
                    titleText = t('title.payingTo', { name: displayName })
                }
                break
            default:
                titleText = displayName
                break
        }
    }

    return titleText
}

const getIcon = (
    direction: TransactionDirection,
    isLinkTransaction?: boolean,
    isTestTransaction?: boolean
): IconName | undefined => {
    if (isLinkTransaction || isTestTransaction) {
        return undefined
    }

    switch (direction) {
        case 'send':
        case 'bank_request_fulfillment':
        case 'qr_payment':
            return 'arrow-up-right'
        case 'request_sent':
        case 'receive':
        case 'request_received':
            return 'arrow-down-left'
        case 'withdraw':
        case 'bank_claim':
        case 'claim_external':
            return 'arrow-up'
        case 'add':
        case 'bank_deposit':
            return 'arrow-down'
        default:
            return undefined
    }
}

export const TransactionDetailsHeaderCard: React.FC<TransactionDetailsHeaderCardProps> = ({
    direction,
    userName,
    amountDisplay,
    initials,
    status,
    isVerified = false,
    isLinkTransaction = false,
    transactionType,
    avatarUrl,
    haveSentMoneyToUser = false,
    isAvatarClickable = false,
    showProgessBar = false,
    progress,
    goal,
    isRequestPotTransaction,
    isTransactionClosed,
    convertedAmount,
    showFullName,
    fullName,
    countryCode,
}) => {
    const router = useRouter()
    const t = useTranslations('transaction')
    const typeForAvatar =
        transactionType ?? (direction === 'add' ? 'add' : direction === 'withdraw' ? 'withdraw' : 'send')

    // respect user's showFullName preference: use fullName only if showFullName is true, otherwise use username
    const nameForAvatar = showFullName && fullName ? fullName : userName

    // check if this is a test transaction (setup confirmation)
    const isTestTransaction = userName === 'Enjoy Peanut!'
    const icon = getIcon(direction, isLinkTransaction, isTestTransaction)

    const handleUserPfpClick = () => {
        if (isAvatarClickable) {
            router.push(profileUrl(userName))
        }
    }

    const isNoGoalSet = isRequestPotTransaction && goal === 0

    return (
        <Card className="relative p-4 md:p-6" position="single">
            {isTestTransaction ? (
                <div className="flex items-center gap-3">
                    <div>
                        <Image src={PEANUTMAN} alt="Peanut Logo" width={64} height={64} className="size-8" />
                    </div>
                    <div>
                        <h2 className="text-xl font-extrabold">Enjoy Peanut!</h2>
                    </div>
                </div>
            ) : (
                <div className="flex items-center gap-3">
                    <div className={twMerge(isAvatarClickable && 'cursor-pointer')} onClick={handleUserPfpClick}>
                        {avatarUrl ? (
                            <div className="flex h-16 w-16 items-center justify-center rounded-full">
                                <Image
                                    src={avatarUrl}
                                    alt="Icon"
                                    className="size-full rounded-full object-cover"
                                    width={160}
                                    height={160}
                                />
                            </div>
                        ) : (
                            <TransactionAvatarBadge
                                initials={initials}
                                userName={nameForAvatar}
                                isLinkTransaction={isLinkTransaction}
                                transactionType={typeForAvatar}
                                context="header"
                                size="small"
                                countryCode={countryCode}
                            />
                        )}
                    </div>
                    <div className="w-full space-y-1">
                        <h2 className="flex items-center gap-2 text-sm font-medium text-grey-1">
                            {icon && <Icon name={icon} size={10} />}
                            <VerifiedUserLabel
                                username={userName}
                                name={
                                    isRequestPotTransaction
                                        ? userName
                                        : (getTitle(t, direction, userName, isLinkTransaction, status) as string)
                                }
                                isVerified={isVerified}
                                className="flex items-center gap-1"
                                haveSentMoneyToUser={haveSentMoneyToUser}
                                iconSize={18}
                                onNameClick={isAvatarClickable ? handleUserPfpClick : undefined}
                            />

                            <div className="ml-auto">
                                {status && <StatusBadge status={status} size="small" className="py-0" />}
                            </div>
                        </h2>
                        <h1
                            className={twMerge(
                                'text-3xl font-extrabold md:text-4xl',
                                ['cancelled', 'refunded'].includes(status ?? '') && 'text-grey-1 line-through',
                                isNoGoalSet && 'text-xl text-black md:text-3xl'
                            )}
                        >
                            {amountDisplay}
                        </h1>

                        {convertedAmount && <h2 className="font-bold">≈ {convertedAmount}</h2>}

                        {isNoGoalSet && <h4 className="text-sm font-medium text-black">{t('noGoalSet')}</h4>}
                    </div>
                </div>
            )}

            {!isNoGoalSet && showProgessBar && goal !== undefined && progress !== undefined && (
                <div className="mt-4">
                    <ProgressBar goal={goal} progress={progress} isClosed={isTransactionClosed} />
                </div>
            )}
        </Card>
    )
}
