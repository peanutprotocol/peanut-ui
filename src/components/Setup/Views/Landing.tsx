'use client'

import { useNativePlatform } from '@/utils/native-platform'
import { useToast } from '@/components/0_Bruddle/Toast'
import { getPasskeyErrorCode, getPasskeyErrorSetupKey, isAlreadyReported } from '@/utils/webauthn.utils'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { useLogin } from '@/hooks/useLogin'
import * as Sentry from '@sentry/nextjs'
import { Button } from '@/components/0_Bruddle/Button'
import { Callout } from '@/components/0_Bruddle/Callout'
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
import { MIGRATION_SURFACES, TEST_WEB_SIGNUP } from '@/constants/migration.consts'
import { DeviceType, useDeviceType } from '@/hooks/useGetDeviceType'
import { useKeepWebBypass } from '@/hooks/useKeepWebBypass'
import Badge from '@/components/Global/Badges/Badge'
import { isCapacitor } from '@/utils/capacitor'
import { useSignupControl } from '@/features/setup/useSignupControl'
import { cancelIOSImmediateLogin, supportsIOSImmediateLogin } from '@/utils/landing-passkeys'

const PASSKEY_CHECK_TIMEOUT_MS = 5_000

// One cancel is often deliberate. On iOS and the web a phone with no Peanut
// passkey closes the sheet the same way, so the recovery drawer waits for the repeat.
const LOGIN_CANCELS_BEFORE_RECOVERY = 2

type RecoveryAction = 'retry' | 'signup' | 'support' | 'dismiss'

const LandingStep = () => {
    const nativePlatform = useNativePlatform()

    const t = useTranslations('setup')
    const tMigration = useTranslations('migration')
    const hasKeepWebBypass = useKeepWebBypass()
    const { deviceType } = useDeviceType()

    // On the web NEW signups are app-only, so the app download leads and Log In
    // drops to a text link for existing accounts. Native app and keep-web
    // bypass users see the normal card.
    const blockSignup = !nativePlatform.isCapacitor && !hasKeepWebBypass
    const { handleNext } = useSetupFlow()
    const { handleLoginClick, isLoggingIn } = useLogin()
    const toast = useToast()
    const { track } = useSignupControl()
    const [isRecoveryOpen, setIsRecoveryOpen] = useState(false)
    const [isAccountDeleted, setIsAccountDeleted] = useState(false)
    const loginCancelsRef = useRef(0)
    // Set by a drawer action, so the close that follows it is not logged as a dismiss.
    const recoveryActionRef = useRef<RecoveryAction | null>(null)

    const { isHydrated, isNativeBridge, isIOSNative } = nativePlatform
    const loginHandler = useRef(handleLoginClick)
    const iosPreparation = useRef<AbortController | null>(null)
    // The automatic iOS login can keep its sheet open past the deadline, so it is not cut off
    // there; Log in and Sign up stay usable and retire it first when tapped.
    const autoLogin = useRef<{ cancel: AbortController; done: Promise<void> } | null>(null)
    const [autoLoginPending, setAutoLoginPending] = useState(false)
    const fallbackBusy = useRef(false)

    useEffect(() => {
        loginHandler.current = handleLoginClick
    }, [handleLoginClick])

    useEffect(() => {
        if (!isHydrated || !nativePlatform.isCapacitor) return
        const check = new AbortController()
        const { signal } = check
        const deadline = Date.now() + PASSKEY_CHECK_TIMEOUT_MS
        const timer = setTimeout(() => check.abort(), PASSKEY_CHECK_TIMEOUT_MS)

        if (isIOSNative && isNativeBridge) {
            iosPreparation.current = check
            void supportsIOSImmediateLogin()
                .then(async (supported) => {
                    if (!supported || signal.aborted || Date.now() >= deadline) return
                    const cancel = new AbortController()
                    const done = loginHandler
                        .current({ immediateSignal: signal, immediateDeadline: deadline, cancelSignal: cancel.signal })
                        .then(
                            () => {},
                            () => {}
                        )
                    const attempt = { cancel, done }
                    autoLogin.current = attempt
                    setAutoLoginPending(true)
                    await done
                    if (autoLogin.current !== attempt) return
                    // A ceremony that timed out can leave the native assertion open; free it so the
                    // next manual login is not refused as already in progress. A no-op after success.
                    await cancelIOSImmediateLogin()
                    if (autoLogin.current === attempt) {
                        autoLogin.current = null
                        setAutoLoginPending(false)
                    }
                })
                .catch(() => {
                    // iOS can report both a silent miss and a dismissed picker as cancellation.
                    // An automatic attempt never shows a toast.
                })
        }

        return () => {
            clearTimeout(timer)
            check.abort()
            if (iosPreparation.current === check) iosPreparation.current = null
        }
    }, [isHydrated, nativePlatform.isCapacitor, isIOSNative, isNativeBridge])

    // The auth landing is a "real auth" surface. Demo mode persists in
    // localStorage, so without this a prior demo session would make Log In /
    // Sign up re-enter demo (user = DEMO_USER → routed to the demo home).
    useEffect(() => {
        disableDemoMode()
    }, [])

    /**
     * The Android app answers "no credential" with PASSKEY_NOT_FOUND since
     * ui#3752, so a cancel there is a deliberate dismissal and keeps the toast.
     * iOS and browsers report an empty passkey list as a cancel, which a
     * deliberate dismissal also is, so a cancel opens the drawer only when it
     * repeats.
     */
    const offersRecovery = (code: string | undefined): boolean => {
        if (code === 'PASSKEY_NOT_FOUND') return true
        if (code === 'LOGIN_CANCELED' && !nativePlatform.isAndroidNative) {
            loginCancelsRef.current += 1
            return loginCancelsRef.current >= LOGIN_CANCELS_BEFORE_RECOVERY
        }
        loginCancelsRef.current = 0
        return false
    }

    const handleError = (error: unknown) => {
        const errorCode = error instanceof Error && 'code' in error ? String(error.code) : undefined
        const passkeyErrorCode = getPasskeyErrorCode(error)
        const recovery = offersRecovery(passkeyErrorCode)
        if (passkeyErrorCode === 'ACCOUNT_DELETED') {
            setIsAccountDeleted(true)
        } else if (recovery) {
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

    const login = async () => {
        setIsAccountDeleted(false)
        try {
            await handleLoginClick()
        } catch (e) {
            handleError(e)
        }
    }

    // Retire the automatic attempt (its late result is discarded) and free the native slot before the manual path starts.
    const retireAutoLogin = async () => {
        const attempt = autoLogin.current
        if (!attempt) return
        // Taken over here, so the attempt's own completion path does not cancel a second time.
        autoLogin.current = null
        attempt.cancel.abort()
        await cancelIOSImmediateLogin()
        await attempt.done
        setAutoLoginPending(false)
    }

    const afterAutoLogin = (next?: () => unknown) => {
        // Capability discovery can still be pending with no attempt to retire. An active
        // attempt also needs this signal to stop options loading from opening a late picker.
        iosPreparation.current?.abort()
        if (!autoLogin.current && !fallbackBusy.current) {
            next?.()
            return
        }
        if (fallbackBusy.current) return
        fallbackBusy.current = true
        void retireAutoLogin()
            .then(next)
            .finally(() => {
                fallbackBusy.current = false
            })
    }

    const onLoginClick = () => {
        track('log_in', 'tap')
        afterAutoLogin(login)
    }

    const signUp = () => {
        posthog.capture(ANALYTICS_EVENTS.SIGNUP_CLICKED)
        handleNext()
    }

    const onSignUpClick = () => {
        track('sign_up', 'tap')
        afterAutoLogin(signUp)
    }

    const recover = (action: RecoveryAction) => {
        recoveryActionRef.current = action
        posthog.capture(ANALYTICS_EVENTS.LOGIN_RECOVERY_ACTION, { action, native: isCapacitor() })
        track(`recovery_${action}`, 'tap')
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
                    track('login_recovery', 'dismiss')
                }
                recoveryActionRef.current = null
                setIsRecoveryOpen(false)
            }}
            onRetry={() => {
                recover('retry')
                afterAutoLogin(login)
            }}
            // Signup is app-only on the blocked web layout; the store buttons sit behind the drawer there.
            onSignUp={
                blockSignup
                    ? undefined
                    : () => {
                          recover('signup')
                          afterAutoLogin(signUp)
                      }
            }
            onSupport={() => recover('support')}
        />
    )

    const recoveryLink = (
        <SetupDocLink
            kind="account-recovery"
            href="/en/help/account-recovery"
            className={LINK_BUTTON_CLASSES}
            onBeforeOpen={afterAutoLogin}
        >
            <Icon name="info" size={16} className="shrink-0" />
            {t('landing.recoverWallet')}
        </SetupDocLink>
    )

    const manualLoginInFlight = isLoggingIn && !autoLoginPending

    const accountDeletedCallout = isAccountDeleted && (
        <Callout priority="error" data-testid="account-deleted">
            {t('passkey.accountDeleted')}
        </Callout>
    )

    if (blockSignup) {
        return (
            <>
                <div className="flex flex-col gap-6">
                    {accountDeletedCallout}
                    <div className="space-y-2 pb-2">
                        {/* heading only above the desktop QR — a lone store button
                            explains itself */}
                        {deviceType === DeviceType.WEB && (
                            <p className="text-center text-label-l text-foreground-primary">
                                {tMigration('banner.title')}
                            </p>
                        )}
                        <StoreButtons
                            surface={MIGRATION_SURFACES.SETUP}
                            onStoreClick={(store) => track('store_button', 'tap', store)}
                        />
                    </div>
                    <div className="text-center">
                        <LinkButton onClick={onLoginClick} disabled={isLoggingIn}>
                            {tMigration('qr.logIn')}
                        </LinkButton>
                    </div>
                    {/* pt-1: two stacked text links need ~28px between their hit areas */}
                    <div className="pt-1 text-center">{recoveryLink}</div>
                    {/* Not a product element: staging, previews and local builds only, so
                        the team can still create web accounts. The dashed frame and badge
                        keep it from reading as a real option in screenshots. */}
                    {TEST_WEB_SIGNUP && (
                        <div className="flex items-center justify-center gap-3 rounded-sm border-[1.5px] border-dashed border-border-default p-3">
                            <Badge status="neutral" customText={t('landing.testBuild')} />
                            <LinkButton onClick={onSignUpClick}>{t('landing.testSignUp')}</LinkButton>
                        </div>
                    )}
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
                        <>
                            {accountDeletedCallout}
                            <Button
                                shadowSize="4"
                                // native only: mid-ceremony Sign Up taps flashed the next setup
                                // step (TASK-21782). On web an abandoned hybrid/QR ceremony can
                                // pend minutes — Sign Up must stay an escape hatch there, and a
                                // mid-ceremony register fails cleanly as CeremonyConflictError.
                                disabled={isLoggingIn && nativePlatform.isCapacitor && !autoLoginPending}
                                onClick={onSignUpClick}
                            >
                                {t('landing.signUp')}
                            </Button>
                        </>
                    }
                    secondary={
                        <Button
                            loading={manualLoginInFlight}
                            shadowSize="4"
                            className="w-full"
                            disabled={manualLoginInFlight}
                            variant="secondary"
                            onClick={onLoginClick}
                        >
                            {t('landing.logIn')}
                        </Button>
                    }
                />
            </div>
            {recoveryDrawer}
        </>
    )
}

export default LandingStep
