import { type RecipientType } from '@/lib/url-parser/types/payment'
import { AVATAR_TEXT_DARK, getColorForUsername } from '@/utils/color.utils'
import { useCallback } from 'react'
import { useTranslations } from 'next-intl'
import AddressLink from '../Global/AddressLink'
import Attachment from '../Global/Attachment'
import Card from '../Global/Card'
import { Icon, type IconName } from '../Global/Icons/Icon'
import AvatarWithBadge, { type AvatarSize } from '../Profile/AvatarWithBadge'
import { VerifiedUserLabel } from '../UserHeader'
import { twMerge } from 'tailwind-merge'
import ProgressBar from '../Global/ProgressBar'
import { ContributorsDrawer } from '@/features/payments/flows/contribute-pot/components/ContributorsDrawer'
import type { PotContributor } from '@/features/payments/flows/contribute-pot/ContributePotFlowContext'

interface UserCardProps {
    type: 'send' | 'request' | 'received_link' | 'request_pay' | 'request_fulfilment'
    username: string
    fullName?: string
    recipientType?: RecipientType
    size?: AvatarSize
    message?: string
    fileUrl?: string
    isVerified?: boolean
    haveSentMoneyToUser?: boolean
    amount?: number
    amountCollected?: number
    isRequestPot?: boolean
    contributors?: PotContributor[]
}

const UserCard = ({
    type,
    username,
    fullName,
    recipientType,
    size = 'extra-small',
    message,
    fileUrl,
    isVerified,
    haveSentMoneyToUser,
    amount,
    amountCollected,
    isRequestPot,
    contributors,
}: UserCardProps) => {
    const t = useTranslations('global')
    const getIcon = (): IconName | undefined => {
        if (type === 'send') return 'arrow-up-right'
        if (type === 'request') return 'arrow-down-left'
        if (type === 'received_link') return 'arrow-down-left'
        if (type === 'request_fulfilment') return 'arrow-up-right'
        return undefined
    }

    const getTitle = useCallback(() => {
        const icon = getIcon()
        let title = ''
        if (type === 'send') title = t('userCard.sendingMoneyTo')
        if (type === 'request') title = t('userCard.requestingMoneyFrom')
        if (type === 'received_link') title = t('userCard.youReceived')
        if (type === 'request_pay') title = t('userCard.isRequesting', { name: fullName ?? username })
        if (type === 'request_fulfilment') title = t('userCard.sendingTo', { name: fullName ?? username })
        return (
            <div className="flex items-center gap-2 text-xs font-normal text-grey-1">
                {icon && <Icon name={icon} size={8} />} {title}
            </div>
        )
    }, [type, fullName, username, t])

    const getAddressLinkTitle = () => {
        if (isRequestPot && amount && amount > 0) return `$${amount}` // If goal is set.
        if (!amount && isRequestPot) return t('userCard.payWhatYouWant') // If no goal is set.

        return username
    }

    return (
        <Card className="flex flex-col items-center gap-4 p-4">
            <div className="flex w-full items-center gap-2">
                <AvatarWithBadge
                    icon={recipientType !== 'USERNAME' ? 'wallet-outline' : undefined}
                    inlineStyle={{
                        backgroundColor:
                            recipientType !== 'USERNAME'
                                ? '#FFD700'
                                : getColorForUsername(fullName || username).lightShade,
                        color:
                            recipientType !== 'USERNAME'
                                ? AVATAR_TEXT_DARK
                                : getColorForUsername(fullName || username).darkShade,
                    }}
                    size={size}
                    name={fullName || username}
                />
                <div>
                    {getTitle()}
                    {recipientType !== 'USERNAME' || type === 'request_pay' || type === 'request_fulfilment' ? (
                        <>
                            {type === 'request_fulfilment' && (
                                <div>
                                    <p className="text-2xl font-extrabold">${amount}</p>
                                    <div className="flex items-center gap-2">
                                        <Icon name="alert-filled" size={16} className="text-yellow-11" />
                                        <p className="text-sm text-yellow-11">{t('userCard.sendExactAmount')}</p>
                                    </div>
                                </div>
                            )}

                            {type !== 'request_fulfilment' && (
                                <AddressLink
                                    // address={amount ? `$${amount}` : username}
                                    address={getAddressLinkTitle()}
                                    className={twMerge(
                                        'text-base font-medium',
                                        type === 'request_pay' && 'text-2xl font-extrabold text-black md:text-3xl'
                                    )}
                                    isLink={type !== 'request_pay'}
                                />
                            )}
                        </>
                    ) : (
                        <VerifiedUserLabel
                            name={fullName ?? username}
                            username={username}
                            isVerified={isVerified}
                            haveSentMoneyToUser={haveSentMoneyToUser}
                            className="text-base font-medium"
                        />
                    )}
                    <Attachment message={message ?? ''} fileUrl={fileUrl ?? ''} />
                </div>
            </div>
            {amount !== undefined && amountCollected !== undefined && type === 'request_pay' && amount > 0 && (
                <ProgressBar goal={amount} progress={amountCollected} isClosed={amountCollected >= amount} />
            )}

            {/* request pot contributors drawer */}
            {isRequestPot && contributors && <ContributorsDrawer contributors={contributors} />}
        </Card>
    )
}

export default UserCard
