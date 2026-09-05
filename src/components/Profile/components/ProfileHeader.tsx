import { Icon } from '@/components/Global/Icons/Icon'
import ShareButton from '@/components/Global/ShareButton'
import { useToast } from '@/components/0_Bruddle/Toast'
import { ANALYTICS_EVENTS, REFERRAL_SOURCES } from '@/constants/analytics.consts'
import { copyTextToClipboard } from '@/utils/clipboard.utils'
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

const REFERRAL_PILL_PROPS = { source: REFERRAL_SOURCES.PROFILE_HEADER, link_type: 'profile' } as const
// the pill's segments are plain hit areas: the frame draws the border and the
// shadow, each segment only keeps the DS focus ring
const SEGMENT_FOCUS = 'focus-visible:outline-[3px] focus-visible:outline-action-focus'

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
    const tGlobal = useTranslations('global')
    const tKyc = useTranslations('kyc')
    const toast = useToast()
    // The self-profile verified badge means "this person's ID was confirmed" —
    // NOT "this person has an enabled payment rail." It reads identityVerification
    // (Sumsub-cleared), matching the counterparty badge logic (`isVerified` on
    // /users/:userId). Rail-approval is unrelated.
    const { isVerified: selfIsIdentityVerified } = useIdentityVerification()
    const isAuthenticatedUserVerified = selfIsIdentityVerified && authenticatedUser?.user.username === username
    const isSelfProfile = authenticatedUser?.user.username?.toLowerCase() === username.toLowerCase()
    const ownAvatar = (size: 'small' | 'large') => (
        <UserAvatar name={username} avatarKey={authenticatedUser?.user.avatarKey} size={size} />
    )

    // `shareableUrl` reads the live origin, so preview and staging share
    // themselves — the old BASE_URL import is non-null-asserted with no fallback.
    const profileUrl = shareableUrl(`/${username}`)
    // the origin half of the pill label, sliced off the shared url so preview
    // and staging read their own host — the handle is the remainder
    const profileDomain = profileUrl.replace('https://', '').slice(0, -username.length)
    const copyProfileUrl = async () => {
        if (await copyTextToClipboard(profileUrl)) toast.info(tGlobal('shareButton.linkCopied'))
        else toast.error(tGlobal('copyToClipboard.copyFailed'))
    }

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
    // On one's own profile the avatar, the name and the share pill said the
    // same thing three times — they are one pill now, three hit areas inside
    // one border, never a button nested in a button: the avatar opens the
    // picker, the handle copies the link, the share icon shares it.
    if (pillVisible) {
        return (
            <div className={twMerge('flex justify-center', className)}>
                <div className="flex h-18 max-w-full items-center rounded-round border border-border-default bg-background-default shadow-4">
                    {onChangeAvatar ? (
                        <button
                            type="button"
                            onClick={onChangeAvatar}
                            aria-label={tAvatar('change')}
                            className={twMerge('flex h-full shrink-0 items-center pl-3', SEGMENT_FOCUS)}
                        >
                            {ownAvatar('small')}
                        </button>
                    ) : (
                        <span className="flex h-full shrink-0 items-center pl-3">{ownAvatar('small')}</span>
                    )}
                    <button
                        type="button"
                        onClick={copyProfileUrl}
                        className={twMerge('flex h-full min-w-0 items-center pl-3', SEGMENT_FOCUS)}
                    >
                        {/* the url alone reads as a link, not as an action */}
                        <span className="sr-only">{tGlobal('copyToClipboard.copyProfileLink')}</span>
                        <span className="shrink-0 text-body-l whitespace-nowrap text-foreground-secondary">
                            {profileDomain}
                        </span>
                        <span className="truncate text-heading-card text-foreground-primary">{username}</span>
                        {isVerified && (
                            <>
                                <Icon name="check" size={16} className="ml-1 shrink-0 text-green-500" aria-hidden />
                                <span className="sr-only">{tKyc('verified')}</span>
                            </>
                        )}
                    </button>
                    {/* the frame draws the chrome: no shadow of its own, no press translate */}
                    <ShareButton
                        url={profileUrl}
                        title=""
                        variant="transparent"
                        shadowSize={null}
                        onSuccess={() => posthog.capture(ANALYTICS_EVENTS.REFERRAL_CTA_CLICKED, REFERRAL_PILL_PROPS)}
                        className="h-full w-auto shrink-0 pr-6 pl-4 active:translate-x-0 active:translate-y-0"
                    >
                        <span className="sr-only">{tGlobal('shareButton.share')}</span>
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
            {isSelfProfile ? (
                onChangeAvatar ? (
                    <button
                        type="button"
                        onClick={onChangeAvatar}
                        aria-label={tAvatar('change')}
                        className={twMerge('rounded-full', SEGMENT_FOCUS)}
                    >
                        {ownAvatar('large')}
                    </button>
                ) : (
                    ownAvatar('large')
                )
            ) : (
                <AvatarWithBadge name={name || username} />
            )}

            {/* Name — dropped entirely when the caller has no name to show.
                Callers without a pill (public profile, profile edit) always
                pass a name, so they keep the row. */}
            {!!name && (
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
            )}
        </div>
    )
}

export default ProfileHeader
