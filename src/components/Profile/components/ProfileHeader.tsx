import { Icon } from '@/components/Global/Icons/Icon'
import ShareButton from '@/components/Global/ShareButton'
import { Button } from '@/components/0_Bruddle/Button'
import { useToast } from '@/components/0_Bruddle/Toast'
import { ANALYTICS_EVENTS, REFERRAL_SOURCES } from '@/constants/analytics.consts'
import { copyTextToClipboard } from '@/utils/clipboard.utils'
import { shareableUrl } from '@/utils/url.utils'
import posthog from 'posthog-js'
import React, { useEffect, useRef } from 'react'
import { twMerge } from '@/utils/tw'
import AvatarWithBadge from '../AvatarWithBadge'
import { useAvatarKey } from '@/components/Avatar/useAvatarKey'
import { UserAvatar } from '@/components/Avatar/UserAvatar'
import { useTranslations } from 'next-intl'
import { VerifiedUserLabel } from '@/components/UserHeader'
import { useAuth } from '@/context/authContext'
import { useIdentityVerification } from '@/hooks/useIdentityVerification'

const REFERRAL_PILL_PROPS = { source: REFERRAL_SOURCES.PROFILE_HEADER, link_type: 'profile' } as const
// The pill is one pressed surface with two hit areas inside it: the frame draws
// the chrome AND the press (the shipped pill's own `primary-soft` values), so a
// tap on either segment presses the whole pill instead of tearing it in half.
const PILL_FRAME =
    'flex h-10 max-w-full items-center rounded-full border border-border-default bg-background-default pr-4 pl-6 shadow-4 transition-all duration-instant active:translate-x-1 active:translate-y-1 active:bg-action-primary active:shadow-none'

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
    const ownAvatarKey = useAvatarKey(authenticatedUser?.user.avatarKey, authenticatedUser?.user.userId)
    const isAuthenticatedUserVerified = selfIsIdentityVerified && authenticatedUser?.user.username === username
    const isSelfProfile = authenticatedUser?.user.username?.toLowerCase() === username.toLowerCase()
    const ownAvatar = (size: 'small' | 'large') => <UserAvatar name={username} avatarKey={ownAvatarKey} size={size} />

    // `shareableUrl` reads the live origin, so preview and staging share
    // themselves — the old BASE_URL import is non-null-asserted with no fallback.
    const profileUrl = shareableUrl(`/${username}`)
    // The url is already in hand, so the write stays inside the click and keeps
    // its user activation — no ClipboardItem reservation needed here.
    const copyProfileUrl = async () => {
        if (!(await copyTextToClipboard(profileUrl))) {
            toast.error(tGlobal('copyToClipboard.copyFailed'))
            return
        }
        toast.info(tGlobal('shareButton.linkCopied'))
        // success only, same as the share segment's REFERRAL_CTA_CLICKED
        posthog.capture(ANALYTICS_EVENTS.PROFILE_LINK_COPIED, REFERRAL_PILL_PROPS)
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

    return (
        <>
            <div className={twMerge('space-y-2 flex flex-col items-center', className)}>
                {/* Own profile shows the first letter of the username; someone
                    else's public profile keeps initials (letters identify others).
                    The generated face (497ab2a5e) is parked until avatar v2.
                    With a picker to open, the sticker sits at 48px inside a 64px
                    round button, so the tap target reads as one (TASK-22142). */}
                {isSelfProfile ? (
                    onChangeAvatar ? (
                        // the DS button, so the press (stroke → action-primary,
                        // translate, shadow drop) is the one in `.btn-*` and is
                        // never re-implemented here
                        <Button
                            type="button"
                            variant="stroke"
                            shadowSize="4"
                            onClick={onChangeAvatar}
                            aria-label={tAvatar('change')}
                            className="size-16 w-16 shrink-0 rounded-full p-0"
                        >
                            {ownAvatar('small')}
                        </Button>
                    ) : (
                        ownAvatar('large')
                    )
                ) : (
                    <AvatarWithBadge name={name || username} />
                )}

                {/* Name — dropped entirely when the caller has no name to show.
                    On the self profile that is the no-full-name case, where the
                    row used to fall back to the username and just repeat the
                    handle the share pill already spells out. Callers without a
                    pill (public profile, profile edit) always pass a name, so
                    they keep the row. */}
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
                {/* `isSelfProfile` guards wrong attribution: `showShareButton`
                    defaults to true, so a caller on someone else's profile would
                    share that other handle. The pill keeps the chrome it shipped
                    with and splits into two hit areas: the handle copies the
                    link, the icon shares it. Never a button inside a button, so
                    the frame is a div. */}
                {pillVisible && (
                    <div className={PILL_FRAME}>
                        <button
                            type="button"
                            onClick={copyProfileUrl}
                            // no chrome of its own — the frame has it all, down
                            // to the press; only the DS focus ring is local
                            className="flex h-full min-w-0 items-center rounded-full focus-visible:outline-[3px] focus-visible:outline-action-focus"
                        >
                            {/* the url alone reads as a link, not as an action */}
                            <span className="sr-only">{tGlobal('copyToClipboard.copyProfileLink')}</span>
                            <span className="truncate text-label-l">{profileUrl.replace('https://', '')}</span>
                            {/* inside the copy segment, as the mockup draws it:
                                the check is not its own hit area. Only without a
                                name row — its check already says it (7 Sep). */}
                            {isVerified && !name && (
                                <>
                                    <Icon name="check" size={16} className="ml-1 shrink-0 text-green-500" aria-hidden />
                                    <span className="sr-only">{tKyc('verified')}</span>
                                </>
                            )}
                        </button>
                        {/* The pill's trailing glyph, 16px as the shipped pill
                            draws it — not an icon-only button, so it gets no box
                            of its own: the frame is the pressed surface and the
                            hit area comes from the `after:` inset (44px). Same
                            flattening as the receipt's referral nudge. */}
                        <ShareButton
                            url={profileUrl}
                            title=""
                            variant="transparent"
                            showIcon={false}
                            onSuccess={() =>
                                posthog.capture(ANALYTICS_EVENTS.REFERRAL_CTA_CLICKED, REFERRAL_PILL_PROPS)
                            }
                            className="relative ml-1 h-auto w-auto shrink-0 p-0 shadow-none after:absolute after:-inset-3.5 active:translate-x-0 active:translate-y-0"
                        >
                            <span className="sr-only">{tGlobal('shareButton.share')}</span>
                            <Icon name="share" size={16} fill="black" />
                        </ShareButton>
                    </div>
                )}
            </div>
        </>
    )
}

export default ProfileHeader
