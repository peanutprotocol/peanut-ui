'use client'
import React, { Suspense, useEffect } from 'react'
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
import { usePasskeySupport } from '@/hooks/usePasskeySupport'

function InvitePageContent() {
    const searchParams = useSearchParams()
    const inviteCode = searchParams.get('code')
    const redirectUri = searchParams.get('redirect_uri')
    const { user } = useAuth()

    const dispatch = useAppDispatch()
    const router = useRouter()
    const { handleLoginClick, isLoggingIn } = useLogin()
    const { isSupported: isPasskeySupported } = usePasskeySupport()

    const {
        data: inviteCodeData,
        isLoading,
        isError,
    } = useQuery({
        queryKey: ['validateInviteCode', inviteCode],
        queryFn: () => invitesApi.validateInviteCode(inviteCode!),
        enabled: !!inviteCode,
    })

    // Redirect logged-in users who already have app access to the inviter's profile
    // Users without app access should stay on this page to claim the invite and get access
    useEffect(() => {
        // Wait for both user and invite data to be loaded
        if (!user?.user || !inviteCodeData || isLoading) {
            return
        }

        // If user has app access and invite is valid, redirect to inviter's profile
        if (user.user.hasAppAccess && inviteCodeData.success && inviteCodeData.username) {
            router.push(`/${inviteCodeData.username}`)
        }
    }, [user, inviteCodeData, isLoading, router])

    const handleClaimInvite = async () => {
        if (inviteCode) {
            dispatch(setupActions.setInviteCode(inviteCode))
            dispatch(setupActions.setInviteType(EInviteType.PAYMENT_LINK))
            saveToCookie('inviteCode', inviteCode) // Save to cookies as well, so that if user installs PWA, they can still use the invite code
            if (redirectUri) {
                const encodedRedirectUri = encodeURIComponent(redirectUri)
                router.push('/setup?step=signup&redirect_uri=' + encodedRedirectUri)
            } else {
                router.push('/setup?step=signup')
            }
        }
    }

    if (isLoading) {
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
                    <div className="flex h-full flex-col justify-between gap-4 md:gap-10 md:pt-5">
                        <h1 className="text-xl font-extrabold">{inviteCodeData?.username} invited you to Peanut</h1>
                        <p className="text-base font-medium">
                            Members-only access. Use this invite to open your wallet and start sending and receiving
                            money globally.
                        </p>
                        <Button onClick={handleClaimInvite} shadowSize="4">
                            Claim your spot
                        </Button>

                        {!user?.user && (
                            <button disabled={isLoggingIn} onClick={handleLoginClick} className="text-sm underline">
                                {isLoggingIn ? 'Please wait...' : 'Already have an account? Log in!'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
            <UnsupportedBrowserModal allowClose={false} visible={!isPasskeySupported} />
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
