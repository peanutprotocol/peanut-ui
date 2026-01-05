'use client'

import { Suspense } from 'react'
import PeanutLoading from '@/components/Global/PeanutLoading'
import { SetupWrapper } from '@/components/Setup/components/SetupWrapper'
import SignTestTransaction from '@/components/Setup/Views/SignTestTransaction'
import chillPeanutAnim from '@/animations/GIF_ALPHA_BACKGORUND/512X512_ALPHA_GIF_konradurban_01.gif'
import { useAuth } from '@/context/authContext'

/**
 * finish setup page for users who logged in but haven't completed account setup
 * shows test transaction step to verify passkey works before finalizing
 */
function FinishSetupPageContent() {
    const { logoutUser, isLoggingOut } = useAuth()

    return (
        <SetupWrapper
            layoutType="signup"
            screenId="sign-test-transaction"
            image={chillPeanutAnim.src}
            showLogoutButton={true}
            onLogout={logoutUser}
            isLoggingOut={isLoggingOut}
            title="Sign a test transaction"
            description="Let's make sure your passkey is working and you have everything set up correctly."
            showBackButton={false}
            showSkipButton={false}
            contentClassName="flex flex-col items-center justify-center gap-5"
        >
            <SignTestTransaction />
        </SetupWrapper>
    )
}

export default function FinishSetupPage() {
    return (
        <Suspense fallback={<PeanutLoading coverFullScreen />}>
            <FinishSetupPageContent />
        </Suspense>
    )
}
