import { useAppOrigin } from '@/hooks/useAppOrigin'
import { Icon } from '@/components/Global/Icons/Icon'
import ShareButton from '@/components/Global/ShareButton'
import { useAppHaptic } from '@/hooks/useAppHaptic'
import { useToast } from '@/components/0_Bruddle/Toast'
import { ANALYTICS_EVENTS, REFERRAL_SOURCES } from '@/constants/analytics.consts'
import { copyTextToClipboard } from '@/utils/clipboard.utils'
import { shareableUrl } from '@/utils/url.utils'
import posthog from 'posthog-js'
import React, { useEffect, useRef } from 'react'
import { twMerge } from '@/utils/tw'
import { UserAvatar } from '@/components/Avatar/UserAvatar'
import type { Person } from '@/lib/person/person.types'
import { useSelfPerson } from '@/lib/person/useSelfPerson'
import { useTranslations } from 'next-intl'
import { VerifiedUserLabel } from '@/components/UserHeader'
import { useAuth } from '@/context/authContext'
import { useIdentityVerification } from '@/hooks/useIdentityVerification'

const REFERRAL_PILL_PROPS = { source: REFERRAL_SOURCES.PROFILE_HEADER, link_type: 'profile' } as const
// Either segment presses the whole pill.
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
    /** Counterparty profile only: the profile owner (TASK-23756). Null while
     *  they load, which leaves the avatar slot empty. The self branch reads the
     *  signed-in user instead. */
    person?: Person | null
}

const ProfileHeader: React.FC<ProfileHeaderProps> = ({
    name,
    username,
    isVerified = false,
    className,
    showShareButton = true,
    haveSentMoneyToUser = false,
    onChangeAvatar,
    person,
}) => {
    const origin = useAppOrigin()
    const { user: authenticatedUser } = useAuth()
    const tAvatar = useTranslations('avatar')
    const tGlobal = useTranslations('global')
    const tKyc = useTranslations('kyc')
    const toast = useToast()
    const { triggerHaptic } = useAppHaptic()
    // The self-profile verified badge means "this person's ID was confirmed" —
    // NOT "this person has an enabled payment rail." It reads identityVerification
    // (Sumsub-cleared), matching the counterparty badge logic (`isVerified` on
    // /users/:userId). Rail-approval is unrelated.
    const { isVerified: selfIsIdentityVerified } = useIdentityVerification()
    const self = useSelfPerson()
    const isAuthenticatedUserVerified = selfIsIdentityVerified && authenticatedUser?.user.username === username
    const isSelfProfile = authenticatedUser?.user.username?.toLowerCase() === username.toLowerCase()
    // a profile shows its owner at the avatar xl (96), on every branch
    const ownAvatar = self && <UserAvatar person={self} size="xl" />

    // Preview and staging links use their own origin.
    const profileUrl = shareableUrl(`/${username}`, origin)
    // Write within the click handler to retain clipboard user activation.
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
                {/* Both branches show the profile owner's chosen avatar — the self
                    one is also the picker button. */}
                {isSelfProfile ? (
                    onChangeAvatar ? (
                        // The sticker itself is the button: plain on the page like
                        // every sticker (no circle, no shadow), so its art is never
                        // cut by a border. A 96 sticker overflowed the old 96 circle.
                        <button
                            type="button"
                            onClick={() => {
                                triggerHaptic()
                                onChangeAvatar()
                            }}
                            aria-label={tAvatar('change')}
                            className="shrink-0 rounded-full focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-action-focus"
                        >
                            {ownAvatar}
                        </button>
                    ) : (
                        ownAvatar
                    )
                ) : (
                    person && <UserAvatar person={person} size="xl" />
                )}

                {/* Without a full name, the self profile's handle appears only in the pill. */}
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
                {pillVisible && (
                    <div className={PILL_FRAME}>
                        <button
                            type="button"
                            onClick={copyProfileUrl}
                            // Extend the 40px pill's hit area vertically to 44px without overlapping share.
                            className="relative flex h-full min-w-0 items-center rounded-full after:absolute after:inset-x-0 after:-inset-y-0.5 focus-visible:outline-[3px] focus-visible:outline-action-focus"
                        >
                            <span className="sr-only">{tGlobal('copyToClipboard.copyProfileLink')}</span>
                            <span className="truncate text-label-l">{profileUrl.replace('https://', '')}</span>
                            {/* Show verification once: in the name row, or here when that row is absent. */}
                            {isVerified && !name && (
                                <>
                                    <Icon name="check" size={16} className="ml-1 shrink-0 text-green-500" aria-hidden />
                                    <span className="sr-only">{tKyc('verified')}</span>
                                </>
                            )}
                        </button>
                        {/* Keep the 16px gap larger than the 14px hit-area extension so share cannot overlap copy. */}
                        <ShareButton
                            url={profileUrl}
                            title=""
                            variant="ghost"
                            showIcon={false}
                            onSuccess={() =>
                                posthog.capture(ANALYTICS_EVENTS.REFERRAL_CTA_CLICKED, REFERRAL_PILL_PROPS)
                            }
                            className="relative ml-4 h-auto w-auto shrink-0 p-0 shadow-none after:absolute after:-inset-3.5"
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
