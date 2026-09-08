'use client'

import { useToast } from '@/components/0_Bruddle/Toast'
import { isAlreadyReported } from '@/utils/webauthn.utils'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { useLogin } from '@/hooks/useLogin'
import * as Sentry from '@sentry/nextjs'
import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useEffect } from 'react'
import { disableDemoMode } from '@/utils/demo'
import DocsLink from '@/components/Global/DocsLink'
import { useTranslations } from 'next-intl'
import StoreButtons from '@/components/Migration/StoreButtons'
import { MIGRATION_SURFACES } from '@/constants/migration.consts'
import { DeviceType, useDeviceType } from '@/hooks/useGetDeviceType'
import { useKeepWebBypass } from '@/hooks/useKeepWebBypass'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'
import { isCapacitor } from '@/utils/capacitor'

const LandingStep = () => {
    const t = useTranslations('setup')
    const tMigration = useTranslations('migration')
    const migrationOn = useMigrationFlag()
    const hasKeepWebBypass = useKeepWebBypass()
    const { deviceType } = useDeviceType()

    // migration notice window on web (any device): NEW signups are closed —
    // don't onboard users into a product that shuts in weeks; the app is the
    // path. Existing users keep Log In until the cutover. Native app and
    // keep-web bypass users see the normal card.
    const blockSignup = migrationOn && !isCapacitor() && !hasKeepWebBypass
    const { handleNext } = useSetupFlow()
    const { handleLoginClick, isLoggingIn } = useLogin()
    const toast = useToast()

    // The auth landing is a "real auth" surface. Demo mode persists in
    // localStorage, so without this a prior demo session would make Log In /
    // Sign up re-enter demo (user = DEMO_USER → routed to the demo home).
    useEffect(() => {
        disableDemoMode()
    }, [])

    const handleError = (error: unknown) => {
        const errorCode = error instanceof Error && 'code' in error ? String(error.code) : undefined
        toast.error((error instanceof Error && error.message) || t('loginFailed'))
        if (!isAlreadyReported(error)) {
            Sentry.captureException(error, { extra: { errorCode } })
        }
        posthog.capture(ANALYTICS_EVENTS.SIGNUP_LOGIN_ERROR, { error_code: errorCode, native: isCapacitor() })
    }

    const onLoginClick = async () => {
        try {
            await handleLoginClick()
        } catch (e) {
            handleError(e)
        }
    }

    return (
        <Card className="border-0">
            <Card.Content className="space-y-4 p-0 pt-4">
                {blockSignup ? (
                    <div className="space-y-2 pb-2">
                        {/* heading only above the desktop QR — a lone store button
                            explains itself */}
                        {deviceType === DeviceType.WEB && (
                            <p className="text-center text-label-l text-foreground-primary">
                                {tMigration('banner.title')}
                            </p>
                        )}
                        <StoreButtons surface={MIGRATION_SURFACES.SETUP} />
                    </div>
                ) : (
                    <Button
                        shadowSize="4"
                        className="h-11"
                        // native only: mid-ceremony Sign Up taps flashed the waitlist
                        // step (TASK-21782). On web an abandoned hybrid/QR ceremony can
                        // pend minutes — Sign Up must stay an escape hatch there, and a
                        // mid-ceremony register fails cleanly as CeremonyConflictError.
                        disabled={isLoggingIn && isCapacitor()}
                        onClick={() => {
                            posthog.capture(ANALYTICS_EVENTS.SIGNUP_CLICKED)
                            handleNext()
                        }}
                    >
                        {t('landing.signUp')}
                    </Button>
                )}
                <Button
                    loading={isLoggingIn}
                    shadowSize="4"
                    disabled={isLoggingIn}
                    className="h-11"
                    variant="primary-soft"
                    onClick={onLoginClick}
                >
                    {t('logIn')}
                </Button>
                <div className="pt-2 text-center">
                    <DocsLink
                        href="/en/help/account-recovery"
                        className="text-body-xs text-foreground-secondary underline underline-offset-2"
                    >
                        {t('landing.recoverWallet')}
                    </DocsLink>
                </div>
            </Card.Content>
        </Card>
    )
}

export default LandingStep
