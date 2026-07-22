'use client'
import { Suspense, useEffect, useRef, useState } from 'react'
import PeanutLoading from '../Global/PeanutLoading'
import ValidationErrorView from '../Payment/Views/Error.validation.view'
import InvitesPageLayout from './InvitesPageLayout'
import { twMerge } from 'tailwind-merge'
import { Button } from '@/components/0_Bruddle/Button'
import { PeanutWavingHello } from '@/assets/mascot'
import { useRouter, useSearchParams } from 'next/navigation'
import { invitesApi } from '@/services/invites'
import { useQuery } from '@tanstack/react-query'
import { useAppDispatch } from '@/redux/hooks'
import { setupActions } from '@/redux/slices/setup-slice'
import { useAuth } from '@/context/authContext'
import { EInviteType } from '@/services/services.types'
import { saveToCookie } from '@/utils/general.utils'
import { useLogin } from '@/hooks/useLogin'
import UnsupportedBrowserModal from '../Global/UnsupportedBrowserModal'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { profileUrl } from '@/utils/native-routes'
import { OFFRAMP_BADGE_CODE, classifyBareCampaign, resolveCampaign } from './campaign-maps'

function InvitePageContent() {
    const searchParams = useSearchParams()
    // trim trailing '?' from invite code to handle qr codes with ? at the end
    const inviteCode = searchParams.get('code')?.toLowerCase().replace(/\?+$/, '')
    const redirectUri = searchParams.get('redirect_uri')
    // support 'campaign', 'campaignTag', and 'utm_campaign' query parameters
    const campaignParam = searchParams.get('campaign') || searchParams.get('campaignTag')
    const utmCampaignParam = searchParams.get('utm_campaign')?.toLowerCase()
    const { user, isFetchingUser, fetchUser } = useAuth()

    // precedence + lowercase-tag mapping live in campaign-maps.ts (unit-tested)
    const campaign = resolveCampaign(campaignParam, inviteCode, utmCampaignParam)

    // Bare campaign link (no invite code) that's claimable without an invite. The
    // effects below treat these specially so a returning logged-in user still gets
    // the badge (useZeroDev's award only fires on new-account registration). The
    // copy distinguishes the two flavours: `isWaitlistSkip` (skip + event_alumni)
    // promises a card-waitlist skip; vanity badges (touched_grass) are claimable
    // but show generic copy. See classifyBareCampaign in campaign-maps.ts.
    const { isBareClaimCampaign, isWaitlistSkip } = classifyBareCampaign(campaign, inviteCode)

    const dispatch = useAppDispatch()
    const router = useRouter()
    const { handleLoginClick, isLoggingIn } = useLogin()
    const [isAwardingBadge, setIsAwardingBadge] = useState(false)
    const hasStartedAwardingRef = useRef(false)

    // Track if we should show content (prevents flash)
    const [shouldShowContent, setShouldShowContent] = useState(false)

    const {
        data: inviteCodeData,
        isLoading,
        isError,
    } = useQuery({
        queryKey: ['validateInviteCode', inviteCode],
        queryFn: () => invitesApi.validateInviteCode(inviteCode!),
        enabled: !!inviteCode,
    })

    // track invite page view (ref guard prevents duplicate fires when shouldShowContent toggles)
    const hasTrackedPageView = useRef(false)
    useEffect(() => {
        if (shouldShowContent && inviteCodeData?.success && !hasTrackedPageView.current) {
            hasTrackedPageView.current = true
            posthog.capture(ANALYTICS_EVENTS.INVITE_PAGE_VIEWED, {
                invite_code: inviteCode,
                inviter_username: inviteCodeData.username,
            })
        }
    }, [shouldShowContent, inviteCodeData, inviteCode])

    // determine if we should show content based on user state
    useEffect(() => {
        if (isFetchingUser) {
            setShouldShowContent(false)
            return
        }
        // wait for the invite query if there is one
        if (inviteCode && isLoading) {
            setShouldShowContent(false)
            return
        }
        // a logged-in visitor on either claim path will be auto-routed by the
        // effect below — keep the loading spinner so they don't see the CTA flash.
        if (
            user?.user &&
            (isBareClaimCampaign || (!redirectUri && user.user.hasAppAccess && inviteCodeData?.success))
        ) {
            setShouldShowContent(false)
            return
        }
        setShouldShowContent(true)
    }, [user, isFetchingUser, redirectUri, inviteCodeData, isLoading, isBareClaimCampaign, inviteCode])

    // Logged-in auto-claim: award the campaign badge then push /home, or fall
    // back to the inviter's profile when there's a valid invite but no campaign.
    // Fires on both the invite-code path (needs hasAppAccess) and the Skip Pass
    // path (badge GRANTS access, so no hasAppAccess gate).
    useEffect(() => {
        if (!user?.user || isFetchingUser || hasStartedAwardingRef.current) return
        // wait for invite-code validation when there is one
        if (inviteCode && (isLoading || !inviteCodeData)) return

        const hasValidInvite = !!inviteCodeData?.success && !!inviteCodeData.username
        const isInviteAutoClaim = !redirectUri && user.user.hasAppAccess && hasValidInvite
        if (!isInviteAutoClaim && !isBareClaimCampaign) return

        hasStartedAwardingRef.current = true

        if (campaign) {
            setIsAwardingBadge(true)
            invitesApi
                .awardBadge(campaign)
                .catch((e) => console.error('Error awarding campaign badge', e))
                .finally(async () => {
                    await fetchUser()
                    setIsAwardingBadge(false)
                    // offramp migrants came here to move their balance — land them
                    // directly on the migration deposit screen, not /home.
                    router.push(
                        campaign === OFFRAMP_BADGE_CODE ? '/add-money/crypto?network=EVM&source=offramp' : '/home'
                    )
                })
            return
        }

        // No campaign on a validated invite → route to inviter profile.
        if (hasValidInvite) {
            router.push(profileUrl(inviteCodeData!.username!))
        }
    }, [
        user,
        inviteCodeData,
        isLoading,
        isFetchingUser,
        router,
        campaign,
        redirectUri,
        fetchUser,
        isBareClaimCampaign,
        inviteCode,
    ])

    const handleClaim = () => {
        const eventTag = inviteCode || (isBareClaimCampaign ? campaign : undefined)
        posthog.capture(ANALYTICS_EVENTS.INVITE_CLAIM_CLICKED, { invite_code: eventTag })

        if (inviteCode) {
            dispatch(setupActions.setInviteCode(inviteCode))
            dispatch(setupActions.setInviteType(EInviteType.PAYMENT_LINK))
            // Save to cookie so PWA-install + later signup still see the invite.
            saveToCookie('inviteCode', inviteCode)
        }
        if (campaign) {
            // useZeroDev reads `campaignTag` post-signup and calls /badge/award.
            saveToCookie('campaignTag', campaign)
        }

        const signupUrl = redirectUri
            ? `/setup?step=signup&redirect_uri=${encodeURIComponent(redirectUri)}`
            : '/setup?step=signup'
        router.push(signupUrl)
    }

    if (isAwardingBadge || !shouldShowContent) {
        return <PeanutLoading coverFullScreen />
    }

    // Invalid invite code (only reachable when an invite code was supplied).
    // Bare-claim campaigns (skip / event_alumni / touched_grass) carry no invite
    // code, so they bypass this gate and never show the invalid-invite screen.
    if (!isBareClaimCampaign && (isError || !inviteCodeData?.success)) {
        return (
            <div className="my-auto flex h-[100dvh] w-screen flex-col items-center justify-center space-y-4 px-6">
                <ValidationErrorView
                    title="Invalid Invite Code"
                    message="The invite code you are trying to use is invalid. Please check the URL and try again."
                    buttonText="Join waitlist"
                    redirectTo="/setup"
                />
            </div>
        )
    }

    // Three copy variants: waitlist-skip (skip + event_alumni), bare vanity badge
    // (touched_grass — claimable but no skip), and the default inviter-code screen.
    const isVanityClaim = isBareClaimCampaign && !isWaitlistSkip
    const title = isWaitlistSkip
        ? "You're skipping the waitlist"
        : isVanityClaim
          ? 'Claim your badge'
          : `${inviteCodeData?.username} invited you to Peanut`
    const description = isWaitlistSkip
        ? 'Someone at Peanut wants you in. Create your wallet and walk straight past the line — no invite code, no queue.'
        : isVanityClaim
          ? 'You earned a Peanut badge. To claim it, sign up or log in.'
          : 'Members-only access. Use this invite to open your wallet and start sending and receiving money globally.'
    const ctaLabel = isWaitlistSkip ? 'Claim your Skip Pass' : isVanityClaim ? 'Sign up' : 'Claim your spot'

    return (
        <InvitesPageLayout image={PeanutWavingHello.src}>
            <div
                className={twMerge(
                    'flex flex-grow flex-col justify-between overflow-hidden bg-white px-6 pb-8 pt-6 md:h-[100dvh] md:justify-center md:space-y-4',
                    'flex flex-col items-end justify-center gap-5 pt-8 '
                )}
            >
                <div className="mx-auto w-full md:max-w-xs">
                    <div className="flex h-full flex-col justify-between gap-4 md:gap-6 md:pt-5">
                        <h1 className="text-xl font-extrabold">{title}</h1>
                        <p className="text-base font-medium">{description}</p>
                        <Button onClick={handleClaim} shadowSize="4">
                            {ctaLabel}
                        </Button>

                        {!user?.user && (
                            <Button
                                disabled={isLoggingIn}
                                loading={isLoggingIn}
                                variant="primary-soft"
                                onClick={handleLoginClick}
                                shadowSize="4"
                            >
                                {isVanityClaim ? 'Log in' : 'Already have an account? Log in!'}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
            <UnsupportedBrowserModal allowClose={false} />
        </InvitesPageLayout>
    )
}

export default function InvitesPage() {
    return (
        <Suspense fallback={<PeanutLoading coverFullScreen />}>
            <InvitePageContent />
        </Suspense>
    )
}
