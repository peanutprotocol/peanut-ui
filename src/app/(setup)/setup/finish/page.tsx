'use client'

import { Suspense } from 'react'
import PeanutLoading from '@/components/Global/PeanutLoading'
import { SetupWrapper } from '@/components/Setup/components/SetupWrapper'
import SignTestTransaction from '@/components/Setup/Views/SignTestTransaction'
import { PeanutWhistling } from '@/assets/mascot'
import { useAuth } from '@/context/authContext'
import { useTranslations } from 'next-intl'

/**
 * finish setup page for users who logged in but haven't completed account setup
 * shows test transaction step to verify passkey works before finalizing
 */
function FinishSetupPageContent() {
    const t = useTranslations('setup')
    const { logoutUser, isLoggingOut } = useAuth()

    return (
        <SetupWrapper
            layoutType="signup"
            screenId="sign-test-transaction"
            image={PeanutWhistling.src}
            showLogoutButton={true}
            onLogout={logoutUser}
            isLoggingOut={isLoggingOut}
            title={t('finish.title')}
            description={t('finish.description')}
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
