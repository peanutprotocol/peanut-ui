'use client'
import { Suspense, useEffect, useRef, useState } from 'react'
import PeanutLoading from '../Global/PeanutLoading'
import ValidationErrorView from '../Payment/Views/Error.validation.view'
import InvitesPageLayout from './InvitesPageLayout'
import { twMerge } from 'tailwind-merge'
import { Button } from '@/components/0_Bruddle/Button'
import peanutAnim from '@/animations/GIF_ALPHA_BACKGORUND/512X512_ALPHA_GIF_konradurban_01.gif'
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

// mapping of special invite codes to their campaign tags
// when these invite codes are used, the corresponding campaign tag is automatically applied
const INVITE_CODE_TO_CAMPAIGN_MAP: Record<string, string> = {
    arbiverseinvitesyou: 'ARBIVERSE_DEVCONNECT_BA_2025',
    squirrelinvitesyou: 'ARBIVERSE_DEVCONNECT_BA_2025', // temporary: maps to arbiverse until 12pm noon tomorrow
    founderhaus: 'FOUNDER_HOUSE',
    touched_grass: 'TOUCHED_GRASS',
    survivor: 'SUPPORT_SURVIVOR',
}

// Map inbound `utm_campaign` values to the badge codes the backend whitelists.
// Lets marketing/event links use a single UTM-shaped URL — PostHog auto-captures
// utm_* on $pageview so the same string also flows into the analytics funnel.
// Backend whitelist lives in peanut-api-ts/src/routes/badge.ts + invite.ts; keep
// in sync when adding a new entry here.
const UTM_CAMPAIGN_TO_BADGE_MAP: Record<string, string> = {
    'token-nation-2026': 'TOKEN_NATION_SP_2026',
    ethfloripa: 'ETHFLORIPA_HUB',
    'touched-grass': 'TOUCHED_GRASS',
}

// /invite?campaign=skip — bypasses the waitlist with no invite code. The backend
// /badge/award endpoint flips hasAppAccess + cardFlowEarlyAccessAt and adds the
// Skip Pass badge (which is also in SKIP_BADGE_CODES, so card-waitlist is bypassed).
const SKIP_CAMPAIGN = 'skip'

function InvitePageContent() {
    const searchParams = useSearchParams()
    // trim trailing '?' from invite code to handle qr codes with ? at the end
    const inviteCode = searchParams.get('code')?.toLowerCase().replace(/\?+$/, '')
    const redirectUri = searchParams.get('redirect_uri')
    // support 'campaign', 'campaignTag', and 'utm_campaign' query parameters
    const campaignParam = searchParams.get('campaign') || searchParams.get('campaignTag')
    const utmCampaignParam = searchParams.get('utm_campaign')?.toLowerCase()
    const { user, isFetchingUser, fetchUser } = useAuth()

    // resolution order: explicit campaign / campaignTag query param wins, then
    // mapped invite code, then mapped utm_campaign. utm_campaign comes last so
    // an explicit ?campaign= can still override on links that carry both.
    const campaign =
        campaignParam ||
        (inviteCode ? INVITE_CODE_TO_CAMPAIGN_MAP[inviteCode] : undefined) ||
        (utmCampaignParam ? UTM_CAMPAIGN_TO_BADGE_MAP[utmCampaignParam] : undefined)

    // Skip-the-waitlist link: no invite code, ?campaign=skip. The auto-claim
    // effect below treats it specially (fires even without hasAppAccess) since
    // awarding the badge IS what grants access.
    const isSkipCampaign = !inviteCode && campaign?.toLowerCase() === SKIP_CAMPAIGN

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
        if (user?.user && (isSkipCampaign || (!redirectUri && user.user.hasAppAccess && inviteCodeData?.success))) {
            setShouldShowContent(false)
            return
        }
        setShouldShowContent(true)
    }, [user, isFetchingUser, redirectUri, inviteCodeData, isLoading, isSkipCampaign, inviteCode])

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
        if (!isInviteAutoClaim && !isSkipCampaign) return

        hasStartedAwardingRef.current = true

        if (campaign) {
            setIsAwardingBadge(true)
            invitesApi
                .awardBadge(campaign)
                .catch((e) => console.error('Error awarding campaign badge', e))
                .finally(async () => {
                    await fetchUser()
                    setIsAwardingBadge(false)
                    router.push('/home')
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
        isSkipCampaign,
        inviteCode,
    ])

    const handleClaim = () => {
        const eventTag = inviteCode || (isSkipCampaign ? SKIP_CAMPAIGN : undefined)
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
    // The skip path has no invite code so it never falls here.
    if (!isSkipCampaign && (isError || !inviteCodeData?.success)) {
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

    const title = isSkipCampaign ? "You're skipping the waitlist" : `${inviteCodeData?.username} invited you to Peanut`
    const description = isSkipCampaign
        ? 'Someone at Peanut wants you in. Create your wallet and walk straight past the line — no invite code, no queue.'
        : 'Members-only access. Use this invite to open your wallet and start sending and receiving money globally.'
    const ctaLabel = isSkipCampaign ? 'Claim your Skip Pass' : 'Claim your spot'

    return (
        <InvitesPageLayout image={peanutAnim.src}>
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
                                Already have an account? Log in!
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
