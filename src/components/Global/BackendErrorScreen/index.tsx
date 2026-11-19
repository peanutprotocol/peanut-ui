'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/context/authContext'
import { Button } from '@/components/0_Bruddle/Button'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import PeanutMascot from '@/components/Global/PeanutMascot'
import { MASCOT_STATE_CLASS } from '@/components/Global/PeanutMascot/PeanutMascot.consts'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'

/**
 * full-page error screen shown when backend requests fail after retries
 * displays the sad peanut and options to retry or log out
 */
export default function BackendErrorScreen() {
    const t = useTranslations('global')
    const { logoutUser, isLoggingOut } = useAuth()

    useEffect(() => {
        posthog.capture(ANALYTICS_EVENTS.BACKEND_ERROR_SHOWN)
    }, [])

    const handleRetry = () => {
        posthog.capture(ANALYTICS_EVENTS.BACKEND_ERROR_RETRY)
        window.location.reload()
    }

    const handleForceLogout = () => {
        posthog.capture(ANALYTICS_EVENTS.BACKEND_ERROR_LOGOUT)
        // Use skipBackendCall since backend is likely down (that's why we're on this screen)
        logoutUser({ skipBackendCall: true })
    }

    return (
        <div className="flex h-dvh w-full flex-col items-center justify-center gap-6 bg-background-page p-6">
            <PeanutMascot pose="sad" className={MASCOT_STATE_CLASS} />
            <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-heading-s">{t('backendErrorScreen.title')}</h1>
                <p className="max-w-md text-body-s">{t('backendErrorScreen.description')}</p>
            </div>
            <div className="flex flex-col items-center gap-4">
                <Button shadowSize="4" icon="retry" size="medium" className="w-fit rounded-full" onClick={handleRetry}>
                    {t('backendErrorScreen.tryAgain')}
                </Button>
                <LinkButton onClick={handleForceLogout} disabled={isLoggingOut}>
                    {isLoggingOut ? t('backendErrorScreen.loggingOut') : t('backendErrorScreen.logOut')}
                </LinkButton>
            </div>
        </div>
    )
}
