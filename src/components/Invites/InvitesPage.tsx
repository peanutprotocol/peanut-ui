'use client'
import { Suspense, useEffect, useRef, useState, useCallback } from 'react'
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
}

// Campaign that bypasses the waitlist with no invite code: /invite?campaign=skip.
// Awarding the Skip Pass badge (backend /badge/award) also flips hasAppAccess.
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

    // skip-the-waitlist link: no invite code required, handled by its own flow below
    const isSkipCampaign = !inviteCode && campaign?.toLowerCase() === SKIP_CAMPAIGN

    const dispatch = useAppDispatch()
    const router = useRouter()
    const { handleLoginClick, isLoggingIn } = useLogin()
    const [isAwardingBadge, setIsAwardingBadge] = useState(false)
    const hasStartedAwardingRef = useRef(false)
    const hasStartedSkipRef = useRef(false)

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
        // if still fetching user, don't show content yet
        if (isFetchingUser) {
            setShouldShowContent(false)
            return
        }

        // if invite validation is still loading, don't show content yet
        if (isLoading) {
            setShouldShowContent(false)
            return
        }

        // if user has app access AND invite is valid, they'll be redirected
        // don't show content in this case (show loading instead)
        if (!redirectUri && user?.user?.hasAppAccess && inviteCodeData?.success) {
            setShouldShowContent(false)
            return
        }

        // otherwise, safe to show content (either error view or invite screen)
        setShouldShowContent(true)
    }, [user, isFetchingUser, redirectUri, inviteCodeData, isLoading])

    // redirect logged-in users who already have app access
    // users without app access should stay on this page to claim the invite and get access
    useEffect(() => {
        // wait for both user and invite data to be loaded
        if (!user?.user || !inviteCodeData || isLoading || isFetchingUser) {
            return
        }

        // prevent running the effect multiple times (ref doesn't trigger re-renders)
        if (hasStartedAwardingRef.current) {
            return
        }

        // if user has app access and invite is valid, handle redirect
        if (!redirectUri && user.user.hasAppAccess && inviteCodeData.success && inviteCodeData.username) {
            // if campaign is present, award the badge and redirect to home
            if (campaign) {
                hasStartedAwardingRef.current = true
                setIsAwardingBadge(true)
                invitesApi
                    .awardBadge(campaign)
                    .then(async () => {
                        // refetch user data to get the newly awarded badge
                        await fetchUser()
                        router.push('/home')
                    })
                    .catch(async () => {
                        // if badge awarding fails, still refetch and redirect
                        await fetchUser()
                        router.push('/home')
                    })
                    .finally(() => {
                        setIsAwardingBadge(false)
                    })
            } else {
                // no campaign, just redirect to inviter's profile
                router.push(profileUrl(inviteCodeData.username))
            }
        }
    }, [user, inviteCodeData, isLoading, isFetchingUser, router, campaign, redirectUri, fetchUser])

    // skip-the-waitlist: a logged-in visitor (even one still in jail) claims immediately —
    // awardBadge('skip') grants app access + the Skip Pass badge on the backend.
    useEffect(() => {
        if (!isSkipCampaign || isFetchingUser || hasStartedSkipRef.current) return
        if (!user?.user) return // not logged in — handled by the claim CTA below

        hasStartedSkipRef.current = true
        setIsAwardingBadge(true)
        invitesApi
            .awardBadge(SKIP_CAMPAIGN)
            .catch((e) => console.error('Error claiming skip pass', e))
            .finally(async () => {
                await fetchUser()
                router.push('/home')
            })
    }, [isSkipCampaign, user, isFetchingUser, fetchUser, router])

    const handleClaimSkip = () => {
        posthog.capture(ANALYTICS_EVENTS.INVITE_CLAIM_CLICKED, { invite_code: SKIP_CAMPAIGN })
        // carry the campaign through signup; useZeroDev awards it once the account exists
        saveToCookie('campaignTag', SKIP_CAMPAIGN)
        router.push('/setup?step=signup')
    }

    const handleClaimInvite = async () => {
        if (inviteCode) {
            posthog.capture(ANALYTICS_EVENTS.INVITE_CLAIM_CLICKED, {
                invite_code: inviteCode,
            })
            dispatch(setupActions.setInviteCode(inviteCode))
            dispatch(setupActions.setInviteType(EInviteType.PAYMENT_LINK))
            saveToCookie('inviteCode', inviteCode) // Save to cookies as well, so that if user installs PWA, they can still use the invite code
            if (campaign) {
                saveToCookie('campaignTag', campaign)
            }
            if (redirectUri) {
                const encodedRedirectUri = encodeURIComponent(redirectUri)
                router.push('/setup?step=signup&redirect_uri=' + encodedRedirectUri)
            } else {
                router.push('/setup?step=signup')
            }
        }
    }

    // skip-the-waitlist link (?campaign=skip, no invite code) — its own flow
    if (isSkipCampaign) {
        // logged-in visitors are auto-claimed by the effect above; show loading while it runs
        if (user?.user || isAwardingBadge || isFetchingUser) {
            return <PeanutLoading coverFullScreen />
        }
        // not logged in — create an account, then useZeroDev awards the skip on signup
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
                            <h1 className="text-xl font-extrabold">You&apos;re skipping the waitlist</h1>
                            <p className="text-base font-medium">
                                Someone at Peanut wants you in. Create your wallet and walk straight past the line — no
                                invite code, no queue.
                            </p>
                            <Button onClick={handleClaimSkip} shadowSize="4">
                                Claim your Skip Pass
                            </Button>
                            <Button
                                disabled={isLoggingIn}
                                loading={isLoggingIn}
                                variant="primary-soft"
                                onClick={handleLoginClick}
                                shadowSize="4"
                            >
                                Already have an account? Log in!
                            </Button>
                        </div>
                    </div>
                </div>
                <UnsupportedBrowserModal allowClose={false} />
            </InvitesPageLayout>
        )
    }

    // show loading if:
    // 1. badge is being awarded
    // 2. we determined content shouldn't be shown yet (covers user fetching + invite validation)
    if (isAwardingBadge || !shouldShowContent) {
        return <PeanutLoading coverFullScreen />
    }

    if (isError || !inviteCodeData?.success) {
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
                        <h1 className="text-xl font-extrabold">{inviteCodeData?.username} invited you to Peanut</h1>
                        <p className="text-base font-medium">
                            Members-only access. Use this invite to open your wallet and start sending and receiving
                            money globally.
                        </p>
                        <Button onClick={handleClaimInvite} shadowSize="4">
                            Claim your spot
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
