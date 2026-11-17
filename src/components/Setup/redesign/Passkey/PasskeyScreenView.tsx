'use client'

import { useTranslations } from 'next-intl'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { PasskeySetupHelpDrawer } from '@/components/Setup/Views/PasskeySetupHelpDrawer'
import { SetupScreen, type SetupScreenProps } from '@/components/Setup/redesign/shell/SetupScreen'
import { DESIGN_STAGE_PX } from '@/components/Setup/redesign/shell/useArtScale'
import { useShellDevice } from '@/components/Setup/redesign/shell/useShellDevice'
import { useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { useSignupControl } from '@/features/setup/useSignupControl'
import type { SignupPasskey } from '@/features/setup/useSignupPasskey'
import { useBackHandler } from '@/hooks/useBackHandler'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { notifyHaptic } from '@/utils/haptics'
import { PasskeyFailureArt } from './PasskeyFailureArt'
import { PasskeyHeroArt } from './PasskeyHeroArt'
import { PasskeyHeroPanel } from './PasskeyHeroPanel'
import { PasskeyInlineError } from './PasskeyInlineError'
import { CANNOT_STATES, FAILED_STATES, type PasskeyScreenState, passkeyScreenState } from './passkeyScreenState'
import { PasskeySteps } from './PasskeySteps'
import { PasskeySupportLine } from './PasskeySupportLine'
import { PasskeyTerms } from './PasskeyTerms'
import { SETUP_LEAD_CLASS } from '@/components/Setup/redesign/shell/shell.consts'

const NARROW_TITLE = 'max-w-[250px]'
const LEAD = `${SETUP_LEAD_CLASS} text-pretty`

/** Copy keys under `setupRedesign.passkey` for each full failure screen; `settings` puts Open settings first. */
type FailureCopy = { title: string; lead: string; steps?: readonly string[]; settings?: boolean }
const FAILURE_COPY: Partial<Record<PasskeyScreenState, FailureCopy>> = {
    'failed-android': { title: 'failedTitle', lead: 'failedLead', steps: ['android1', 'android2', 'android3'] },
    'failed-ios': { title: 'failedTitle', lead: 'failedLead', steps: ['ios1', 'ios2', 'ios3'] },
    'second-cancel': {
        title: 'secondCancelTitle',
        lead: 'secondCancelLead',
        steps: ['secondCancel1', 'secondCancel2', 'secondCancel3'],
    },
    'took-too-long': { title: 'tookTooLongTitle', lead: 'tookTooLongLead' },
    'left-app': { title: 'leftAppTitle', lead: 'leftAppLead' },
    'check-screen-lock': {
        title: 'screenLockTitle',
        lead: 'screenLockLead',
        steps: ['screenLock1', 'screenLock2', 'screenLock3'],
        settings: true,
    },
    'check-no-provider': {
        title: 'noProviderTitle',
        lead: 'noProviderLead',
        steps: ['noProvider1', 'noProvider2', 'noProvider3'],
        settings: true,
    },
}

/**
 * 03 Passkey's screens for one `useSignupPasskey` state. The hero states ask for the passkey; taken, failed and
 * can't-save are full screens that never move the flow on (only "Pick another username" goes back to 02). Takes
 * the hook's state as a prop so the dev gallery can show each state; PasskeyScreen wires the real hook.
 */
export function PasskeyScreenView({ passkey }: { passkey: SignupPasskey }) {
    const t = useTranslations('setupRedesign')
    const { username } = useSetupFlowContext()
    const { setScreenId } = useSetupFlow()
    const { track } = useSignupControl()
    const sm = useShellDevice() === 'sm'

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
        const copy = FAILURE_COPY[state] as FailureCopy
        const passkeyText = (key: string) => t(`passkey.${key}` as Parameters<typeof t>[0])
        // The pre-check screens send the person to Settings first; Try again checks the phone once more.
        const footer: SetupScreenProps['footer'] = copy.settings
            ? {
                  primary: {
                      label: t('passkey.openSettings'),
                      onClick: () => {
                          track('passkey_settings', 'tap')
                          passkey.openSettings()
                      },
                      testId: 'passkey-open-settings',
                  },
                  secondary: retryButton,
              }
            : { primary: retryButton, slot: support }
        screen = {
            stage: 'compact',
            artBesideTitle: true,
            title: passkeyText(copy.title),
            titleClassName: NARROW_TITLE,
            art: <PasskeyFailureArt state={state} />,
            footer,
        }
        body = (
            <>
                <p className={LEAD}>{passkeyText(copy.lead)}</p>
                {copy.steps && (
                    <div className="mt-3">
                        <PasskeySteps steps={copy.steps.map(passkeyText)} />
                    </div>
                )}
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
