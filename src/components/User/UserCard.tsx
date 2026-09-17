import { type RecipientType } from '@/lib/url-parser/types/payment'
import { AVATAR_TEXT_DARK } from '@/utils/color.utils'
import { useCallback } from 'react'
import { useTranslations } from 'next-intl'
import AddressLink from '../Global/AddressLink'
import Attachment from '../Global/Attachment'
import { Card } from '../0_Bruddle/Card'
import { Icon, type IconName } from '../Global/Icons/Icon'
import AvatarWithBadge, { type AvatarSize } from '../Profile/AvatarWithBadge'
import { UserAvatar } from '../Avatar/UserAvatar'
import { VerifiedUserLabel } from '../UserHeader'
import PotProgress from './PotProgress'
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
    /** The other person's picked avatar (TASK-22625). Read only when
     *  `recipientType` is USERNAME — an address has nobody behind it. */
    avatarKey?: string | null
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
    avatarKey,
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
            <div className="flex items-center gap-2 text-body-xs text-foreground-secondary">
                {icon && <Icon name={icon} size={16} />} {title}
            </div>
        )
    }, [type, fullName, username, t])

    const getAddressLinkTitle = () => {
        if (isRequestPot && amount && amount > 0) return `$${amount}` // If goal is set.
        if (!amount && isRequestPot) return t('userCard.payWhatYouWant') // If no goal is set.

        return username
    }

    return (
        <Card className="w-full flex-col items-center gap-4 p-4">
            <div className="flex w-full items-center gap-2">
                {recipientType === 'USERNAME' ? (
                    // A Peanut handle is a person: their picked avatar, with the
                    // handle's letter as the fallback. `decorative` because the
                    // card names them right beside it.
                    <UserAvatar name={username} avatarKey={avatarKey} size={size} decorative />
                ) : (
                    <AvatarWithBadge
                        icon="wallet-outline"
                        inlineStyle={{
                            // drift fix: was an off-token gold hex — snapped to the DS yellow
                            backgroundColor: 'var(--color-background-icon-bubble-yellow)',
                            color: AVATAR_TEXT_DARK,
                        }}
                        size={size}
                        name={fullName || username}
                    />
                )}
                <div>
                    {getTitle()}
                    {recipientType !== 'USERNAME' || type === 'request_pay' || type === 'request_fulfilment' ? (
                        <>
                            {type === 'request_fulfilment' && (
                                <div>
                                    <p className="text-heading-s text-foreground-primary">${amount}</p>
                                    <div className="flex items-center gap-2">
                                        <Icon name="alert-filled" size={16} className="text-foreground-attention" />
                                        <p className="text-body-s text-foreground-attention">
                                            {t('userCard.sendExactAmount')}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {type !== 'request_fulfilment' && (
                                <AddressLink
                                    // address={amount ? `$${amount}` : username}
                                    address={getAddressLinkTitle()}
                                    // ds size tokens only on the raw-span branch (isLink=false).
                                    // the link branch goes through AddressLink's twMerge, which
                                    // deletes ds text tokens (unconfigured twMerge groups them
                                    // as colors) — keep stock classes there.
                                    className={
                                        type === 'request_pay'
                                            ? 'text-heading-s text-foreground-primary'
                                            : 'text-body-m'
                                    }
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
                            className="text-body-m"
                        />
                    )}
                    <Attachment message={message ?? ''} fileUrl={fileUrl ?? ''} />
                </div>
            </div>
            {amount !== undefined && amountCollected !== undefined && type === 'request_pay' && amount > 0 && (
                <PotProgress goal={amount} progress={amountCollected} isClosed={amountCollected >= amount} />
            )}

            {/* request pot contributors drawer */}
            {isRequestPot && contributors && <ContributorsDrawer contributors={contributors} />}
        </Card>
    )
}

export default UserCard
