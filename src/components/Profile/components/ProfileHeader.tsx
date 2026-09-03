import { Icon } from '@/components/Global/Icons/Icon'
import ShareButton from '@/components/Global/ShareButton'
import { ANALYTICS_EVENTS, REFERRAL_SOURCES } from '@/constants/analytics.consts'
import { shareableUrl } from '@/utils/url.utils'
import posthog from 'posthog-js'
import React, { useEffect, useRef } from 'react'
import { twMerge } from '@/utils/tw'
import AvatarWithBadge from '../AvatarWithBadge'
import { UserAvatar } from '@/components/Avatar/UserAvatar'
import type { AvatarSize } from '@/components/Profile/avatar-size.consts'
import { useTranslations } from 'next-intl'
import { VerifiedUserLabel } from '@/components/UserHeader'
import { useAuth } from '@/context/authContext'
import { useIdentityVerification } from '@/hooks/useIdentityVerification'

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
    const avatarSlot = (size: AvatarSize, slotClassName?: string) => {
        const avatar = <UserAvatar name={username} avatarKey={authenticatedUser?.user.avatarKey} size={size} />
        return onChangeAvatar ? (
            <button
                type="button"
                onClick={onChangeAvatar}
                aria-label={tAvatar('change')}
                className={twMerge(
                    'rounded-full focus-visible:outline-[3px] focus-visible:outline-action-focus',
                    slotClassName
                )}
            >
                {avatar}
            </button>
        ) : (
            <span className={slotClassName}>{avatar}</span>
        )
    }

    // `shareableUrl` reads the live origin, so preview and staging share
    // themselves — the old BASE_URL import is non-null-asserted with no fallback.
    const profileUrl = shareableUrl(`/${username}`)
    // the origin half of the pill label, sliced off the shared url so preview
    // and staging read their own host — the handle is the remainder
    const profileDomain = profileUrl.replace('https://', '').slice(0, -username.length)

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

    // `isSelfProfile` guards wrong attribution: `showShareButton` defaults to
    // true, so a caller on someone else's profile would share that other handle.
    // On one's own profile the avatar, the handle and the share link said the
    // same thing three times — they are one pill now, two hit areas in one
    // border: the avatar opens the picker, the rest shares.
    if (pillVisible) {
        return (
            <div className={twMerge('flex justify-center', className)}>
                <div className="btn-shadow-primary-4 flex h-[72px] max-w-full items-center rounded-full border border-black bg-white">
                    {avatarSlot('small', 'shrink-0 p-3')}
                    {/* The frame draws the border and the shadow; this half is
                        only a hit area. `[&>span]:min-w-0` reaches ShareButton's
                        own content wrapper, without which the handle cannot
                        shrink and so never truncates. */}
                    <ShareButton
                        url={profileUrl}
                        title=""
                        variant="primary-soft"
                        showIcon={false}
                        onSuccess={() => posthog.capture(ANALYTICS_EVENTS.REFERRAL_CTA_CLICKED, REFERRAL_PILL_PROPS)}
                        className="h-full w-auto min-w-0 rounded-full border-none bg-transparent pr-6 pl-0.5 shadow-none active:translate-x-0 active:translate-y-0 active:bg-transparent [&>span]:min-w-0"
                    >
                        <span className="flex min-w-0 items-center text-label-l">
                            <span className="font-medium text-grey-1">{profileDomain}</span>
                            <span className="truncate font-extrabold text-black">{username}</span>
                            {isVerified && <Icon name="check" size={20} className="ml-[9px] shrink-0 text-success-1" />}
                            <Icon name="share" size={18} className="ml-[18px] shrink-0" />
                        </span>
                    </ShareButton>
                </div>
            </div>
        )
    }

    return (
        <div className={twMerge('space-y-2 flex flex-col items-center', className)}>
            {/* Own profile shows the first letter of the username; someone
                else's public profile keeps initials (letters identify others).
                The generated face (497ab2a5e) is parked until avatar v2. */}
            {isSelfProfile ? avatarSlot('large') : <AvatarWithBadge name={name || username} />}

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
            </div>
        </div>
    )
}

export default ProfileHeader
