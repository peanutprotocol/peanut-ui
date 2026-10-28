'use client'

import { useNativePlatform } from '@/utils/native-platform'
import { useToast } from '@/components/0_Bruddle/Toast'
import { getPasskeyErrorCode, getPasskeyErrorSetupKey, isAlreadyReported } from '@/utils/webauthn.utils'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { useLogin } from '@/hooks/useLogin'
import * as Sentry from '@sentry/nextjs'
import { Button } from '@/components/0_Bruddle/Button'
import { Icon } from '@/components/Global/Icons/Icon'
import SetupFooter from '../components/SetupFooter'
import { LoginRecoveryDrawer } from './LoginRecoveryDrawer'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useEffect, useRef, useState } from 'react'
import { disableDemoMode } from '@/utils/demo'
import { SetupDocLink } from '@/components/Setup/components/SetupDocsDrawer'
import { LINK_BUTTON_CLASSES, LinkButton } from '@/components/0_Bruddle/LinkButton'
import { useTranslations } from 'next-intl'
import StoreButtons from '@/components/Migration/StoreButtons'
import { MIGRATION_SURFACES } from '@/constants/migration.consts'
import { DeviceType, useDeviceType } from '@/hooks/useGetDeviceType'
import { useKeepWebBypass } from '@/hooks/useKeepWebBypass'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'
import { isCapacitor } from '@/utils/capacitor'

// One cancel is often deliberate. On iOS and the web a phone with no Peanut
// passkey closes the sheet the same way, so the recovery drawer waits for the repeat.
const LOGIN_CANCELS_BEFORE_RECOVERY = 2

type RecoveryAction = 'retry' | 'signup' | 'support' | 'dismiss'

const LandingStep = () => {
    const nativePlatform = useNativePlatform()

    const t = useTranslations('setup')
    const tMigration = useTranslations('migration')
    const migrationOn = useMigrationFlag()
    const hasKeepWebBypass = useKeepWebBypass()
    const { deviceType } = useDeviceType()

    // pwa-sunset on web (any device): NEW signups are app-only, so the app
    // download leads and Log In drops to a text link for existing accounts.
    // Native app and keep-web bypass users see the normal card.
    const blockSignup = migrationOn && !nativePlatform.isCapacitor && !hasKeepWebBypass
    const { handleNext } = useSetupFlow()
    const { handleLoginClick, isLoggingIn } = useLogin()
    const toast = useToast()
    const [isRecoveryOpen, setIsRecoveryOpen] = useState(false)
    const loginCancelsRef = useRef(0)
    // Set by a drawer action, so the close that follows it is not logged as a dismiss.
    const recoveryActionRef = useRef<RecoveryAction | null>(null)

    // The auth landing is a "real auth" surface. Demo mode persists in
    // localStorage, so without this a prior demo session would make Log In /
    // Sign up re-enter demo (user = DEMO_USER → routed to the demo home).
    useEffect(() => {
        disableDemoMode()
    }, [])

    /**
     * Android answers "no credential" with PASSKEY_NOT_FOUND since ui#3752. iOS
     * and the web report an empty passkey list as a cancel, which a deliberate
     * dismissal also is, so a cancel opens the drawer only when it repeats.
     */
    const offersRecovery = (code: string | undefined): boolean => {
        if (code === 'PASSKEY_NOT_FOUND') return true
        if (code === 'LOGIN_CANCELED') {
            loginCancelsRef.current += 1
            return loginCancelsRef.current >= LOGIN_CANCELS_BEFORE_RECOVERY
        }
        loginCancelsRef.current = 0
        return false
    }

    const handleError = (error: unknown) => {
        const errorCode = error instanceof Error && 'code' in error ? String(error.code) : undefined
        const recovery = offersRecovery(getPasskeyErrorCode(error))
        if (recovery) {
            recoveryActionRef.current = null
            setIsRecoveryOpen(true)
        } else {
            const i18nKey = getPasskeyErrorSetupKey(error)
            toast.error(i18nKey ? t(i18nKey) : (error instanceof Error && error.message) || t('loginFailed'))
        }
        if (!isAlreadyReported(error)) {
            Sentry.captureException(error, { extra: { errorCode } })
        }
        posthog.capture(ANALYTICS_EVENTS.SIGNUP_LOGIN_ERROR, {
            error_code: errorCode,
            native: isCapacitor(),
            recovery_drawer: recovery,
        })
    }

    const onLoginClick = async () => {
        try {
            await handleLoginClick()
        } catch (e) {
            handleError(e)
        }
    }

    const onSignUpClick = () => {
        posthog.capture(ANALYTICS_EVENTS.SIGNUP_CLICKED)
        handleNext()
    }

    const recover = (action: RecoveryAction) => {
        recoveryActionRef.current = action
        posthog.capture(ANALYTICS_EVENTS.LOGIN_RECOVERY_ACTION, { action, native: isCapacitor() })
        setIsRecoveryOpen(false)
    }

    const recoveryDrawer = (
        <LoginRecoveryDrawer
            visible={isRecoveryOpen}
            platform={deviceType}
            onClose={() => {
                if (recoveryActionRef.current === null) {
                    posthog.capture(ANALYTICS_EVENTS.LOGIN_RECOVERY_ACTION, {
                        action: 'dismiss',
                        native: isCapacitor(),
                    })
                }
                recoveryActionRef.current = null
                setIsRecoveryOpen(false)
            }}
            onRetry={() => {
                recover('retry')
                void onLoginClick()
            }}
            // Signup is app-only on the blocked web layout; the store buttons sit behind the drawer there.
            onSignUp={
                blockSignup
                    ? undefined
                    : () => {
                          recover('signup')
                          onSignUpClick()
                      }
            }
            onSupport={() => recover('support')}
        />
    )

    const recoveryLink = (
        <SetupDocLink kind="account-recovery" href="/en/help/account-recovery" className={LINK_BUTTON_CLASSES}>
            <Icon name="info" size={16} className="shrink-0" />
            {t('landing.recoverWallet')}
        </SetupDocLink>
    )

    if (blockSignup) {
        return (
            <>
                <div className="flex flex-col gap-6">
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
                    <div className="text-center">
                        <LinkButton onClick={onLoginClick} disabled={isLoggingIn}>
                            {tMigration('qr.logIn')}
                        </LinkButton>
                    </div>
                    {/* pt-1: two stacked text links need ~28px between their hit areas */}
                    <div className="pt-1 text-center">{recoveryLink}</div>
                </div>
                {recoveryDrawer}
            </>
        )
    }

    // Sign up sits at the primary height every step shares; Log in takes the slot below it.
    return (
        <>
            <div className="flex flex-1 flex-col">
                <div className="text-left">{recoveryLink}</div>
                <SetupFooter
                    actions={
                        <Button
                            shadowSize="4"
                            // native only: mid-ceremony Sign Up taps flashed the next setup
                            // step (TASK-21782). On web an abandoned hybrid/QR ceremony can
                            // pend minutes — Sign Up must stay an escape hatch there, and a
                            // mid-ceremony register fails cleanly as CeremonyConflictError.
                            disabled={isLoggingIn && nativePlatform.isCapacitor}
                            onClick={onSignUpClick}
                        >
                            {t('landing.signUp')}
                        </Button>
                    }
                    secondary={
                        <Button
                            loading={isLoggingIn}
                            shadowSize="4"
                            className="w-full"
                            disabled={isLoggingIn}
                            variant="secondary"
                            onClick={onLoginClick}
                        >
                            {t('logIn')}
                        </Button>
                    }
                />
            </div>
            {recoveryDrawer}
        </>
    )
}

export default LandingStep
