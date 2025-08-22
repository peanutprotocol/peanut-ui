import CopyToClipboard from '@/components/Global/CopyToClipboard'
import { BASE_URL } from '@/components/Global/DirectSendQR/utils'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import Link from 'next/link'
import { Icon } from '../Global/Icons/Icon'
import { twMerge } from 'tailwind-merge'
import { Tooltip } from '../Tooltip'

interface UserHeaderProps {
    username: string
    fullName?: string
    isVerified?: boolean
}

export const UserHeader = ({ username, fullName, isVerified }: UserHeaderProps) => {
    return (
        <div className="flex items-center gap-1.5">
            <Link href={`/profile`} className="flex items-center gap-2">
                <AvatarWithBadge
                    size="extra-small"
                    className="h-7 w-7 text-[11px] md:h-8 md:w-8 md:text-[13px]"
                    name={fullName || username}
                />
                <VerifiedUserLabel name={username} isVerified={isVerified} />
            </Link>
            <CopyToClipboard textToCopy={`${BASE_URL}/${username}`} fill="black" iconSize={'4'} />
        </div>
    )
}

export const VerifiedUserLabel = ({
    name,
    isVerified,
    className,
    iconSize = 14,
    haveSentMoneyToUser = false,
    isAuthenticatedUserVerified = false,
}: {
    name: string
    isVerified: boolean | undefined
    className?: HTMLDivElement['className']
    iconSize?: number
    haveSentMoneyToUser?: boolean
    isAuthenticatedUserVerified?: boolean
}) => {
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

    return (
        <div className="flex items-center gap-1.5">
            <div className={twMerge('text-sm font-semibold md:text-base', className)}>{name}</div>
            {badge && (
                <Tooltip id="verified-user-label" content={tooltipContent} position="top">
                    {badge}
                </Tooltip>
            )}
        </div>
    )
}
