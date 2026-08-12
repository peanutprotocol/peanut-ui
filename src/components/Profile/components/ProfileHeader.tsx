import { Button } from '@/components/0_Bruddle/Button'
import { useToast } from '@/components/0_Bruddle/Toast'
import { Icon } from '@/components/Global/Icons/Icon'
import { ANALYTICS_EVENTS, REFERRAL_SOURCES } from '@/constants/analytics.consts'
import { shareableUrl } from '@/utils/url.utils'
import { copyTextToClipboardWithFallback } from '@/utils/general.utils'
import { useTranslations } from 'next-intl'
import posthog from 'posthog-js'
import React, { useEffect, useRef } from 'react'
import { twMerge } from 'tailwind-merge'
import AvatarWithBadge from '../AvatarWithBadge'
import { VerifiedUserLabel } from '@/components/UserHeader'
import { useAuth } from '@/context/authContext'
import { useIdentityVerification } from '@/hooks/useIdentityVerification'
import CopyToClipboard from '@/components/Global/CopyToClipboard'

interface ProfileHeaderProps {
    name: string
    username: string
    isVerified?: boolean
    className?: string
    showShareButton?: boolean
    haveSentMoneyToUser?: boolean
}

const ProfileHeader: React.FC<ProfileHeaderProps> = ({
    name,
    username,
    isVerified = false,
    className,
    showShareButton = true,
    haveSentMoneyToUser = false,
}) => {
    const t = useTranslations('global')
    const toast = useToast()
    const { user: authenticatedUser } = useAuth()
    // The self-profile verified badge means "this person's ID was confirmed" —
    // NOT "this person has an enabled payment rail." It reads identityVerification
    // (Sumsub-cleared), matching the counterparty badge logic (`isVerified` on
    // /users/:userId). Rail-approval is unrelated.
    const { isVerified: selfIsIdentityVerified } = useIdentityVerification()
    const isAuthenticatedUserVerified = selfIsIdentityVerified && authenticatedUser?.user.username === username
    const isSelfProfile = authenticatedUser?.user.username?.toLowerCase() === username.toLowerCase()

    // `shareableUrl` reads the live origin, so preview and staging share themselves
    // instead of `undefined/<username>` (the old BASE_URL import is non-null-asserted
    // with no fallback).
    const profileUrl = shareableUrl(`/${username}`)

    // Impression leg, once per mount — every other REFERRAL_SOURCES surface
    // emits SHOWN, and a clicks-only source reads as infinite CTR in PostHog.
    const pillVisible = showShareButton && isSelfProfile
    const impressionFired = useRef(false)
    useEffect(() => {
        if (!pillVisible || impressionFired.current) return
        impressionFired.current = true
        posthog.capture(ANALYTICS_EVENTS.REFERRAL_CTA_SHOWN, {
            source: REFERRAL_SOURCES.PROFILE_HEADER,
            link_type: 'profile',
        })
    }, [pillVisible])

    return (
        <>
            <div className={twMerge('flex flex-col items-center space-y-2', className)}>
                {/* Avatar with initials */}
                <AvatarWithBadge name={name || username} />

                {/* Name */}
                <div className="flex items-center gap-1.5">
                    <VerifiedUserLabel
                        name={name}
                        username={username}
                        isVerified={isVerified}
                        className="text-2xl font-bold"
                        iconSize={20}
                        haveSentMoneyToUser={haveSentMoneyToUser}
                        isAuthenticatedUserVerified={isAuthenticatedUserVerified && isSelfProfile} // can be true only for self profile
                    />
                    <CopyToClipboard textToCopy={username} fill="black" iconSize="5" />
                </div>
                {/* Username with share drawer. `isSelfProfile` guards wrong attribution:
                    `showShareButton` defaults to true, so a future caller on someone
                    else's profile would share that other handle. It also hides the pill
                    while auth resolves, instead of showing `peanut.me/anonymous`. */}
                {pillVisible && (
                    <Button
                        size="large"
                        variant="primary-soft"
                        shadowSize="4"
                        className="flex h-10 w-fit items-center justify-center rounded-full py-3 pl-6 pr-4"
                        onClick={async () => {
                            // Outcome, not intent — matches the receipt and badge
                            // surfaces, so profile_header clicks stay comparable.
                            const captureShared = () =>
                                posthog.capture(ANALYTICS_EVENTS.REFERRAL_CTA_CLICKED, {
                                    source: REFERRAL_SOURCES.PROFILE_HEADER,
                                    link_type: 'profile',
                                })
                            if (navigator.share) {
                                navigator
                                    .share({
                                        url: profileUrl,
                                    })
                                    .then(captureShared)
                                    .catch((error) => {
                                        console.error('Error sharing:', error)
                                    })
                            } else {
                                // Desktop fallback: navigator.share is mobile-only.
                                // The util resolves only after a real copy (secure-
                                // context aware, textarea fallback), so the toast
                                // can't claim a write the browser rejected — and
                                // without one the click is silent and users assume
                                // the button is broken.
                                const copied = await copyTextToClipboardWithFallback(profileUrl)
                                if (!copied) return
                                toast.info(t('shareButton.linkCopied'))
                                captureShared()
                            }
                        }}
                    >
                        <div className="text-sm font-semibold">{profileUrl.replace('https://', '')}</div>
                        <div className="-ml-2">
                            <Icon name="share" size={16} fill="black" />
                        </div>
                    </Button>
                )}
            </div>
        </>
    )
}

export default ProfileHeader
