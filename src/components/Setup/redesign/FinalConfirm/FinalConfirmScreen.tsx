'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Callout } from '@/components/0_Bruddle/Callout'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { SetupScreen } from '@/components/Setup/redesign/shell/SetupScreen'
import type { SetupFooterButton } from '@/components/Setup/redesign/shell/shell.types'
import { useSignupControl } from '@/features/setup/useSignupControl'
import { FinalConfirmArt } from './FinalConfirmArt'
import { PasskeyInfoSheet } from './PasskeyInfoSheet'
import { useFinalConfirm } from './useFinalConfirm'
import { SETUP_LEAD_CLASS } from '@/components/Setup/redesign/shell/shell.consts'

export type FinalConfirmScreenProps = {
    /** Called once the account is set up; the step then shows the celebration. */
    onComplete?: () => void
    /** `/setup/finish` (a signed-in user who never finished): a "Log out" link under the button. */
    showLogout?: boolean
}

const BUSY = 'testTransaction.errors.networkBusy'
const SETUP_FAILED = 'testTransaction.errors.setupFailed'
const REFRESH = [
    'testTransaction.errors.loadUserFailed',
    'testTransaction.errors.noWalletAddress',
    'testTransaction.errors.userNotLoaded',
]
const ERROR_STATE: Record<string, string> = {
    'testTransaction.errors.supportNeeded': 'error-support',
    'testTransaction.errors.passkeyProviderUnsupported': 'error-provider',
    'testTransaction.errors.confirmAgain': 'error-confirm-again',
}

/**
 * 11 Final confirm (step `advantage-control` before sign-up completes, and `/setup/finish` with `showLogout`):
 * try the passkey once on a test transaction, then finish the account. Contract P4 § 4.
 */
export function FinalConfirmScreen({ onComplete, showLogout }: FinalConfirmScreenProps) {
    const t = useTranslations('setupRedesign')
    const tSetup = useTranslations('setup')
    const tCommon = useTranslations('common')
    const tProfile = useTranslations('profile')
    const { track } = useSignupControl()
    const f = useFinalConfirm({ onComplete })
    const [infoOpen, setInfoOpen] = useState(false)

    const busy = f.errorKey === BUSY
    const setupFailed = f.errorKey === SETUP_FAILED
    // the redesign's lines for the two drawn errors; every other error keeps dev's catalog line
    const displayError = f.errorKey
        ? busy
            ? t('final.busy')
            : setupFailed
              ? t('final.setupFailed')
              : tSetup(f.errorKey)
        : f.setupError
    const prompting = f.isSigning && !f.testTransactionCompleted
    const success = f.testTransactionCompleted && !displayError

    const state = infoOpen
        ? 'what-passkey'
        : f.errorKey
          ? busy
              ? f.canDefer
                  ? 'network-busy'
                  : 'network-busy-first'
              : setupFailed
                ? 'setup-failed'
                : REFRESH.includes(f.errorKey)
                  ? 'error-refresh'
                  : (ERROR_STATE[f.errorKey] ?? 'error-passkey')
          : f.setupError
            ? 'setup-failed'
            : f.loadingUser
              ? 'loading-user'
              : success
                ? 'success'
                : prompting
                  ? 'prompt'
                  : 'default'

    // dev's precedence: Loading… → Retry account setup → Try again → Confirm & finish
    const label: Pick<SetupFooterButton, 'label' | 'icon'> = f.loadingUser
        ? { label: tCommon('loading') }
        : f.testTransactionCompleted && displayError
          ? { label: t('final.retrySetup'), icon: 'retry' }
          : busy
            ? { label: t('common.retry'), icon: 'retry' }
            : success
              ? { label: t('final.cta'), icon: 'check' }
              : { label: t('final.cta') }
    // every label runs the same handler: a completed signature is not signed again on a retry
    const primary: SetupFooterButton = {
        ...label,
        testId: 'setup-redesign-primary',
        loading: f.isLoading && !success,
        disabled: f.isLoading,
        onClick: () => {
            track('finish', 'tap')
            void f.confirm()
        },
    }

    const inert = prompting || success
    const slot = (
        <span className="flex items-center justify-center gap-6" data-testid="setup-redesign-slot">
            {busy && f.canDefer ? (
                <LinkButton
                    onClick={() => {
                        track('finish_later', 'tap')
                        void f.confirm({ defer: true })
                    }}
                    disabled={f.isLoading}
                >
                    {t.rich('final.later', { link: (chunks) => chunks })}
                </LinkButton>
            ) : (
                <LinkButton
                    onClick={() => {
                        track('passkey_info', 'open')
                        setInfoOpen(true)
                    }}
                    disabled={inert}
                >
                    {t.rich('final.what', { link: (chunks) => chunks })}
                </LinkButton>
            )}
        </span>
    )
    const below = showLogout ? (
        <LinkButton
            onClick={() => {
                track('log_out', 'tap')
                void f.logoutUser()
            }}
            disabled={f.isLoggingOut}
            data-testid="setup-redesign-below"
        >
            {tProfile('logOut')}
        </LinkButton>
    ) : undefined

    return (
        <SetupScreen
            ground="sky"
            stage="std"
            artTop={196}
            smScale={0.68}
            title={t('final.title')}
            art={<FinalConfirmArt scanning={prompting} locked={success} />}
            state={state}
            footer={{ primary, slot, below }}
        >
            <div data-testid="setup-redesign-final-confirm" data-setup-state={state}>
                <p className={SETUP_LEAD_CLASS}>{t('final.desc')}</p>
                {displayError && (
                    <Callout priority={busy ? 'attention' : 'error'} className="mt-3.5 signup-sm:mt-3">
                        {displayError}
                    </Callout>
                )}
            </div>
            <PasskeyInfoSheet open={infoOpen} onClose={() => setInfoOpen(false)} />
        </SetupScreen>
    )
}
