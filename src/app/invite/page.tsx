'use client'
import InvitesPageLayout from '@/components/Invites/InvitesPageLayout'

import peanutAnim from '@/animations/GIF_ALPHA_BACKGORUND/512X512_ALPHA_GIF_konradurban_01.gif'
import { twMerge } from 'tailwind-merge'
import { Button } from '@/components/0_Bruddle'
import { useRouter, useSearchParams } from 'next/navigation'
import { invitesApi } from '@/services/invites'
import { useQuery } from '@tanstack/react-query'
import PeanutLoading from '@/components/Global/PeanutLoading'
import { useAppDispatch } from '@/redux/hooks'
import { setupActions } from '@/redux/slices/setup-slice'
import ValidationErrorView from '@/components/Payment/Views/Error.validation.view'

export default function InvitePage() {
    const searchParams = useSearchParams()
    const inviteCode = searchParams.get('code')

    const dispatch = useAppDispatch()
    const router = useRouter()

    const {
        data: inviteCodeData,
        isLoading,
        isError,
    } = useQuery({
        queryKey: ['validateInviteCode', inviteCode],
        queryFn: () => invitesApi.validateInviteCode(inviteCode!),
        enabled: !!inviteCode,
    })

    const handleClaimInvite = async () => {
        if (inviteCode) {
            dispatch(setupActions.setInviteCode(inviteCode))
            router.push('/setup?step=signup')
        }
    }

    if (isLoading) {
        return <PeanutLoading coverFullScreen />
    }

    if (isError || !inviteCodeData) {
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

                        <button className="text-sm underline">Already have an account? Log in!</button>
                    </div>
                </div>
            </div>
        </InvitesPageLayout>
    )
}
