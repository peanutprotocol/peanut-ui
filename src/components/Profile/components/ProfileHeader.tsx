import { Icon } from '@/components/Global/Icons/Icon'
import ShareButton from '@/components/Global/ShareButton'
import { ANALYTICS_EVENTS, REFERRAL_SOURCES } from '@/constants/analytics.consts'
import { shareableUrl } from '@/utils/url.utils'
import posthog from 'posthog-js'
import React, { useEffect, useRef } from 'react'
import { twMerge } from '@/utils/tw'
import AvatarWithBadge from '../AvatarWithBadge'
import { UserAvatar } from '@/components/Avatar/UserAvatar'
import { useTranslations } from 'next-intl'
import { VerifiedUserLabel } from '@/components/UserHeader'
import { useAuth } from '@/context/authContext'
import { useIdentityVerification } from '@/hooks/useIdentityVerification'
import CopyToClipboard from '@/components/Global/CopyToClipboard'

const REFERRAL_PILL_PROPS = { source: REFERRAL_SOURCES.PROFILE_HEADER, link_type: 'profile' } as const

interface ProfileHeaderProps {
    name: string
    username: string
    isVerified?: boolean
    className?: string
    showShareButton?: boolean
    haveSentMoneyToUser?: boolean
    /** Self profile only: makes the avatar a button that opens the picker (TASK-22142). */
    onChangeAvatar?: () => void
}

const ProfileHeader: React.FC<ProfileHeaderProps> = ({
    name,
    username,
    isVerified = false,
    className,
    showShareButton = true,
    haveSentMoneyToUser = false,
    onChangeAvatar,
}) => {
    const { user: authenticatedUser } = useAuth()
    const tAvatar = useTranslations('avatar')
    // The self-profile verified badge means "this person's ID was confirmed" —
    // NOT "this person has an enabled payment rail." It reads identityVerification
    // (Sumsub-cleared), matching the counterparty badge logic (`isVerified` on
    // /users/:userId). Rail-approval is unrelated.
    const { isVerified: selfIsIdentityVerified } = useIdentityVerification()
    const isAuthenticatedUserVerified = selfIsIdentityVerified && authenticatedUser?.user.username === username
    const isSelfProfile = authenticatedUser?.user.username?.toLowerCase() === username.toLowerCase()
    const ownAvatar = <UserAvatar name={username} avatarKey={authenticatedUser?.user.avatarKey} size="large" />

    // `shareableUrl` reads the live origin, so preview and staging share
    // themselves — the old BASE_URL import is non-null-asserted with no fallback.
    const profileUrl = shareableUrl(`/${username}`)

    // Once per continuous visibility, re-armed when the pill hides: the
    // [...recipient] route reuses this component instance across profile
    // navigations, so a mount-scoped latch would undercount self → other →
    // self round trips.
    const pillVisible = showShareButton && isSelfProfile
    const impressionFired = useRef(false)
    useEffect(() => {
        if (!pillVisible) {
            impressionFired.current = false
            return
        }
        if (impressionFired.current) return
        impressionFired.current = true
        posthog.capture(ANALYTICS_EVENTS.REFERRAL_CTA_SHOWN, REFERRAL_PILL_PROPS)
    }, [pillVisible])

    return (
        <>
            <div className={twMerge('space-y-2 flex flex-col items-center', className)}>
                {/* Own profile shows the first letter of the username; someone
                    else's public profile keeps initials (letters identify others).
                    The generated face (497ab2a5e) is parked until avatar v2. */}
                {isSelfProfile ? (
                    onChangeAvatar ? (
                        <button
                            type="button"
                            onClick={onChangeAvatar}
                            aria-label={tAvatar('change')}
                            className="rounded-full focus-visible:outline-[3px] focus-visible:outline-action-focus"
                        >
                            {ownAvatar}
                        </button>
                    ) : (
                        ownAvatar
                    )
                ) : (
                    <AvatarWithBadge name={name || username} />
                )}

                {/* Name */}
                <div className="flex items-center gap-1">
                    <VerifiedUserLabel
                        name={name}
                        username={username}
                        isVerified={isVerified}
                        className="text-heading-s text-foreground-primary"
                        iconSize={20}
                        haveSentMoneyToUser={haveSentMoneyToUser}
                        isAuthenticatedUserVerified={isAuthenticatedUserVerified && isSelfProfile} // can be true only for self profile
                    />
                    <CopyToClipboard textToCopy={username} fill="black" iconSize="5" />
                </div>
                {/* `isSelfProfile` guards wrong attribution: `showShareButton`
                    defaults to true, so a caller on someone else's profile would
                    share that other handle. */}
                {pillVisible && (
                    <ShareButton
                        url={profileUrl}
                        title=""
                        variant="primary-soft"
                        showIcon={false}
                        onSuccess={() => posthog.capture(ANALYTICS_EVENTS.REFERRAL_CTA_CLICKED, REFERRAL_PILL_PROPS)}
                        className="h-10 w-fit rounded-full py-3 pr-4 pl-6"
                    >
                        <div className="text-label-l">{profileUrl.replace('https://', '')}</div>
                        <div className="-ml-2">
                            <Icon name="share" size={16} fill="black" />
                        </div>
                    </ShareButton>
                )}
            </div>
        </>
    )
}

export default ProfileHeader
