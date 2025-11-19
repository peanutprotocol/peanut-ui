'use client'
import { Suspense, useEffect, useRef, useState } from 'react'
import PeanutLoading from '../Global/PeanutLoading'
import ValidationErrorView from '../Payment/Views/Error.validation.view'
import InvitesPageLayout from './InvitesPageLayout'
import { twMerge } from 'tailwind-merge'
import { Button } from '../0_Bruddle'
import peanutAnim from '@/animations/GIF_ALPHA_BACKGORUND/512X512_ALPHA_GIF_konradurban_01.gif'
import { useRouter, useSearchParams } from 'next/navigation'
import { invitesApi } from '@/services/invites'
import { useQuery } from '@tanstack/react-query'
import { useAppDispatch } from '@/redux/hooks'
import { setupActions } from '@/redux/slices/setup-slice'
import { useAuth } from '@/context/authContext'
import { EInviteType } from '@/services/services.types'
import { saveToCookie } from '@/utils'
import { useLogin } from '@/hooks/useLogin'
import UnsupportedBrowserModal from '../Global/UnsupportedBrowserModal'

// mapping of special invite codes to their campaign tags
// when these invite codes are used, the corresponding campaign tag is automatically applied
const INVITE_CODE_TO_CAMPAIGN_MAP: Record<string, string> = {
    arbiverseinvitesyou: 'ARBIVERSE_DEVCONNECT_BA_2025',
    squirrelinvitesyou: 'ARBIVERSE_DEVCONNECT_BA_2025', // temporary: maps to arbiverse until 12pm noon tomorrow
}

function InvitePageContent() {
    const searchParams = useSearchParams()
    // trim trailing '?' from invite code to handle qr codes with ? at the end
    const inviteCode = searchParams.get('code')?.toLowerCase().replace(/\?+$/, '')
    const redirectUri = searchParams.get('redirect_uri')
    // support both 'campaign' and 'campaignTag' query parameters
    const campaignParam = searchParams.get('campaign') || searchParams.get('campaignTag')
    const { user, isFetchingUser, fetchUser } = useAuth()

    // determine campaign tag: use query param if provided (takes precedence), otherwise check invite code mapping
    const campaign = campaignParam || (inviteCode ? INVITE_CODE_TO_CAMPAIGN_MAP[inviteCode] : undefined)

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
                router.push(`/${inviteCodeData.username}`)
            }
        }
    }, [user, inviteCodeData, isLoading, isFetchingUser, router, campaign, redirectUri, fetchUser])

    const handleClaimInvite = async () => {
        if (inviteCode) {
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
