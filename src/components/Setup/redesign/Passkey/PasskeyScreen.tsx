'use client'

import { useTranslations } from 'next-intl'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import type { StepComponentProps } from '@/components/Setup/Setup.types'
import { PasskeySetupHelpDrawer } from '@/components/Setup/Views/PasskeySetupHelpDrawer'
import { SetupScreen, type SetupScreenProps } from '@/components/Setup/redesign/shell/SetupScreen'
import { DESIGN_STAGE_PX } from '@/components/Setup/redesign/shell/useArtScale'
import { useShellDevice } from '@/components/Setup/redesign/shell/useShellDevice'
import { useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { useSignupControl } from '@/features/setup/useSignupControl'
import { useSignupPasskey } from '@/features/setup/useSignupPasskey'
import { useBackHandler } from '@/hooks/useBackHandler'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { notifyHaptic } from '@/utils/haptics'
import { PasskeyFailureArt } from './PasskeyFailureArt'
import { PasskeyHeroArt } from './PasskeyHeroArt'
import { PasskeyHeroPanel } from './PasskeyHeroPanel'
import { PasskeyInlineError } from './PasskeyInlineError'
import { CANNOT_STATES, FAILED_STATES, passkeyScreenState } from './passkeyScreenState'
import { PasskeySteps } from './PasskeySteps'
import { PasskeySupportLine } from './PasskeySupportLine'
import { PasskeyTerms } from './PasskeyTerms'
import { usePasskeyReservationRefresh } from './usePasskeyReservationRefresh'
import { SETUP_LEAD_CLASS } from '@/components/Setup/redesign/shell/shell.consts'

const NARROW_TITLE = 'max-w-[250px]'
const LEAD = `${SETUP_LEAD_CLASS} text-pretty`

/**
 * 03 Passkey (step `passkey`): creates the account with a passkey. The hero states ask for it; taken, failed and
 * can't-save are full screens that never move the flow on (only "Pick another username" goes back to 02). The real
 * OS sheet opens from `claim()`. Mock: scaffold/screens/03-passkey; contract: build/contract/C.md § 3.2, § 4.5–4.8.
 */
export function PasskeyScreen(_props: StepComponentProps) {
    const t = useTranslations('setupRedesign')
    const { username } = useSetupFlowContext()
    const passkey = useSignupPasskey(username)
    const { setScreenId } = useSetupFlow()
    const { track } = useSignupControl()
    const sm = useShellDevice() === 'sm'
    usePasskeyReservationRefresh(username, passkey.isClaiming)

    const { state, helpDrawer } = passkeyScreenState(passkey)
    const failed = FAILED_STATES.includes(state)
    const cannot = CANNOT_STATES.includes(state)
    const message =
        passkey.inlineErrorCode === 'cancelled'
            ? t('passkey.cancelled')
            : (passkey.inlineError ?? passkey.preflightWarning)

    // dev Views/Passkey.tsx: one `passkey_help:open` per opening, for the full screens and the drawer alike
    const helpWasOpen = useRef(false)
    useEffect(() => {
        if (passkey.isHelpOpen && !helpWasOpen.current) track('passkey_help', 'open')
        helpWasOpen.current = passkey.isHelpOpen
    }, [passkey.isHelpOpen, track])

    useEffect(() => {
        if (state === 'error-inline' || state === 'taken' || failed || cannot) notifyHaptic('error')
    }, [state, failed, cannot, message])

    // The tap's beat: the hero's sheet grows and the brackets flash twice.
    const [flash, setFlash] = useState(0)
    useEffect(() => {
        if (passkey.isClaiming) setFlash((count) => count + 1)
    }, [passkey.isClaiming])

    // Back (arrow or hardware) closes a failure screen first; the step stays.
    useBackHandler(() => {
        if (failed) {
            track('passkey_help', 'dismiss')
            passkey.closeHelp()
        } else {
            track('passkey_provider', 'dismiss')
            passkey.closeProviderUnsupported()
        }
        return true
    }, failed || cannot)

    const createPasskey = () => {
        track('create_passkey', 'tap')
        void passkey.claim()
    }
    const retry = () => {
        if (failed) {
            track('passkey_help_retry', 'tap')
            passkey.retryFromHelp()
        } else {
            track('passkey_provider_retry', 'tap')
            passkey.retryFromProviderUnsupported()
        }
    }
    const support = (
        <PasskeySupportLine
            onSupport={() => track(failed ? 'passkey_help_support' : 'passkey_provider_support', 'tap')}
        />
    )
    const retryButton = { label: t('common.retry'), icon: 'retry' as const, onClick: retry, testId: 'passkey-retry' }

    let screen: Omit<SetupScreenProps, 'ground' | 'state'>
    let body: ReactNode
    if (state === 'taken') {
        const stage = sm ? 'compact' : 'std'
        screen = {
            stage,
            artTop: sm ? DESIGN_STAGE_PX.compact : 195,
            title: t('passkey.takenTitle', { name: `@${username}` }),
            titleClassName: `${NARROW_TITLE} text-balance`,
            art: <PasskeyFailureArt state={state} />,
            footer: {
                primary: {
                    label: t('passkey.takenCta'),
                    onClick: () => {
                        track('taken_pick_another', 'tap')
                        setScreenId('signup')
                    },
                    testId: 'passkey-pick-another',
                },
                secondary: {
                    label: t('passkey.logIn'),
                    loading: passkey.isLoggingIn,
                    disabled: passkey.isLoggingIn,
                    onClick: () => {
                        track('log_in', 'tap')
                        void passkey.logIn()
                    },
                    testId: 'passkey-log-in',
                },
            },
        }
        body = (
            <>
                <p className={LEAD}>{t('passkey.takenLead')}</p>
                {passkey.inlineError && <PasskeyInlineError message={passkey.inlineError} className="mt-4" />}
            </>
        )
    } else if (failed) {
        const steps =
            state === 'failed-ios'
                ? (['ios1', 'ios2', 'ios3'] as const)
                : (['android1', 'android2', 'android3'] as const)
        screen = {
            stage: 'compact',
            artBesideTitle: true,
            title: t('passkey.failedTitle'),
            titleClassName: NARROW_TITLE,
            art: <PasskeyFailureArt state={state} />,
            footer: { primary: retryButton, slot: support },
        }
        body = (
            <>
                <p className={LEAD}>{t('passkey.failedLead')}</p>
                <div className="mt-3">
                    <PasskeySteps steps={steps.map((key) => t(`passkey.${key}`))} />
                </div>
            </>
        )
    } else if (state === 'cannot-create') {
        screen = {
            stage: 'compact',
            artBesideTitle: true,
            title: t('passkey.cannotTitle'),
            titleClassName: `${NARROW_TITLE} text-balance`,
            art: <PasskeyFailureArt state={state} />,
            footer: {
                primary: retryButton,
                secondary: {
                    label: t('passkey.browser'),
                    small: true,
                    onClick: () => {
                        track('passkey_provider_web_signup', 'tap')
                        void passkey.signUpInBrowser()
                    },
                    testId: 'passkey-browser',
                },
                below: support,
            },
        }
        // dev dropped the "browser didn't open" box (TASK-24967); a failed open goes to Sentry, the buttons stay
        body = <PasskeySteps steps={[t('passkey.cannot1'), t('passkey.cannot2')]} firstDelay={0.2} />
    } else if (state === 'cannot-create-other') {
        screen = {
            stage: sm ? 'compact' : 'std',
            artTop: sm ? DESIGN_STAGE_PX.compact : 204,
            title: t('passkey.cannotTitle'),
            titleClassName: sm ? `${NARROW_TITLE} text-balance` : 'text-balance',
            art: <PasskeyFailureArt state={state} />,
            footer: { primary: retryButton, slot: support },
        }
        body = <p className={LEAD}>{t('passkey.cannotOther')}</p>
    } else {
        screen = {
            stage: 'std',
            artTop: 168,
            smScale: 0.66,
            title: t('passkey.s1.title'),
            art: <PasskeyHeroArt username={username} asking={passkey.isClaiming} flash={flash} />,
            footer: {
                primary: {
                    label: t('passkey.s1.cta'),
                    loading: passkey.isClaiming,
                    disabled: passkey.isClaiming,
                    onClick: createPasskey,
                    testId: 'passkey-create',
                },
                slot: <PasskeyTerms />,
            },
        }
        body = <PasskeyHeroPanel message={state === 'error-inline' ? message : null} />
    }

    return (
        <SetupScreen ground="pink" state={state} smScale={0.66} {...screen}>
            <div data-testid="setup-redesign-passkey">{body}</div>
            {passkey.helpErrorName && (
                <PasskeySetupHelpDrawer
                    visible={helpDrawer}
                    errorName={passkey.helpErrorName}
                    platform={passkey.deviceType}
                    onClose={() => {
                        track('passkey_help', 'dismiss')
                        passkey.closeHelp()
                    }}
                    onRetry={() => {
                        track('passkey_help_retry', 'tap')
                        passkey.retryFromHelp()
                    }}
                    onSupport={() => track('passkey_help_support', 'tap')}
                />
            )}
        </SetupScreen>
    )
}
