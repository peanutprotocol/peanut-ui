'use client'

import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import Link from 'next/link'
import { Icon } from '../Global/Icons/Icon'
import { twMerge } from 'tailwind-merge'
import { Tooltip } from '../Tooltip'
import { useMemo } from 'react'
import { isAddress } from 'viem'
import { useAuth } from '@/context/authContext'
import AddressLink from '../Global/AddressLink'
import { Button } from '@/components/0_Bruddle/Button'

interface UserHeaderProps {
    username: string
    fullName?: string
    isVerified?: boolean
}

export const UserHeader = ({ username, fullName, isVerified }: UserHeaderProps) => {
    const { user } = useAuth()
    // respect user's showFullName preference: use fullName only if showFullName is true, otherwise use username
    const nameForAvatar = user?.user.showFullName && fullName ? fullName : username

    return (
        <Link href={`/profile`} className="block">
            <Button
                variant="primary-soft"
                className={twMerge(
                    'flex h-8 w-auto cursor-pointer items-center justify-center gap-1.5 rounded-full px-2.5 md:h-9 md:px-3.5'
                )}
                shadowSize="3"
                size="small"
            >
                <AvatarWithBadge
                    size="extra-small"
                    className="h-5 w-5 text-[10px] md:h-6 md:w-6 md:text-[11px]"
                    name={nameForAvatar}
                />
                <span className="whitespace-nowrap text-xs font-semibold md:text-sm">{username}</span>
            </Button>
        </Link>
    )
}

export const VerifiedUserLabel = ({
    name,
    username,
    isVerified,
    className,
    iconSize = 14,
    haveSentMoneyToUser = false,
    isAuthenticatedUserVerified = false,
    onNameClick,
}: {
    name: string
    username: string
    isVerified: boolean | undefined
    className?: HTMLDivElement['className']
    iconSize?: number
    haveSentMoneyToUser?: boolean
    isAuthenticatedUserVerified?: boolean
    onNameClick?: () => void
}) => {
    const { invitedUsernamesSet, user } = useAuth()
    // determine badge and tooltip content based on verification status
    let badge = null
    let tooltipContent = ''

    // A kyc-verified user always gets at least a single badge.
    if (isVerified) {
        badge = <Icon name="check" size={iconSize} className="text-success-1" />
        tooltipContent = isAuthenticatedUserVerified ? "You're a verified user." : 'This is a verified user.'
    }

    // if they are also verified and the viewer has sent them money, it's upgraded to a double badge.
    if (isVerified && haveSentMoneyToUser) {
        badge = <Icon name="double-check" size={iconSize} className="text-success-1" />
        tooltipContent = "This is a verified user and you've sent them money before."
    }

    const isCryptoAddress = useMemo(() => {
        return isAddress(username)
    }, [username])

    // O(1) lookup in pre-computed Set
    const isInvitedByLoggedInUser = invitedUsernamesSet.has(username)

    const isInviter = user?.invitedBy === username

    return (
        <div className="flex items-center gap-1.5">
            {isCryptoAddress ? (
                <AddressLink
                    isLink={false}
                    className={twMerge('font-semibold md:text-base', className)}
                    address={username}
                />
            ) : (
                <div
                    className={twMerge('font-semibold md:text-base', className, onNameClick && 'cursor-pointer')}
                    onClick={onNameClick}
                >
                    {name}
                </div>
            )}

            {badge && (
                <Tooltip id="verified-user-label" content={tooltipContent} position="top">
                    {badge}
                </Tooltip>
            )}
            {(isInvitedByLoggedInUser || isInviter) && (
                <Tooltip
                    id={isInviter ? 'inviter-user' : 'invited-by-user'}
                    content={isInviter ? 'You were invited by this user.' : `You've invited ${name}`}
                    position="top"
                >
                    <Icon name="invite-heart" size={iconSize} />
                </Tooltip>
            )}
        </div>
    )
}
