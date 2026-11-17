'use client'

import { useTranslations } from 'next-intl'
import { Callout } from '@/components/0_Bruddle/Callout'
import { LINK_BUTTON_CLASSES } from '@/components/0_Bruddle/LinkButton'
import { Icon } from '@/components/Global/Icons/Icon'
import { SetupDocLink } from '@/components/Setup/components/SetupDocsDrawer'
import type { StepComponentProps } from '@/components/Setup/Setup.types'
import { SetupScreen } from '@/components/Setup/redesign/shell/SetupScreen'
import { LoginRecoveryDrawer } from '@/components/Setup/Views/LoginRecoveryDrawer'
import { useLandingLogin } from '@/features/setup/useLandingLogin'
import { useStashedInviteCode } from '@/features/setup/useStashedInviteCode'
import { LandingWebBlock } from './LandingWebBlock'
import { X1Hero } from './X1Hero'
import { SETUP_LEAD_CLASS } from '@/components/Setup/redesign/shell/shell.consts'

/**
 * 01 Landing (step `landing`), X1 "coin bridge" (mock scaffold screens/01-landing). The native app and keep-web users
 * get Sign up and Log in in the fixed footer; the web gets the download-only block in the panel and no footer. The
 * recovery link follows dev's rule (after one real log-in error, or the second cancel in a row on iPhone and the web).
 * Contract: mono _temp/signup-redesign/r2/r9/build/contract/P1.md. A person who arrives through an invite (a deferred
 * link or an invite link) reads who invited them in the headline (v7); with no source, the default headline and the
 * trust line under it (addendum 1).
 */
export function LandingScreen(_props: StepComponentProps) {
    const t = useTranslations('setupRedesign.landing')
    const tSetup = useTranslations('setup')
    const landing = useLandingLogin()
    const inviter = useStashedInviteCode()

    const recoveryLink = landing.loginFailed && (
        <SetupDocLink kind="account-recovery" href="/en/help/account-recovery" className={LINK_BUTTON_CLASSES}>
            <Icon name="info" size={16} className="shrink-0" />
            {t('recover')}
        </SetupDocLink>
    )
    const accountDeletedCallout = landing.isAccountDeleted && (
        <Callout priority="error" data-testid="account-deleted">
            {tSetup('passkey.accountDeleted')}
        </Callout>
    )
    const sub = <p className={`${SETUP_LEAD_CLASS} text-pretty`}>{t('sub')}</p>

    return (
        <SetupScreen
            ground="sky"
            stage="tall"
            title={inviter ? t('invitedTitle', { username: inviter }) : t('title')}
            // a long username is one word: let it break rather than run off the screen
            titleClassName={inviter ? 'break-words' : undefined}
            // organic installs (no invite source) read the trust line; NEEDS LEGAL CHECK before merge (TASK-25063)
            subtitle={inviter ? undefined : t('trustLine')}
            titleSize="l"
            artTop={194}
            smScale={0.62}
            chrome={{ back: false, dots: false }}
            state={landing.loginFailed ? 'login-failed' : 'default'}
            art={<X1Hero />}
            footer={
                landing.blockSignup
                    ? null
                    : {
                          primary: {
                              label: t('cta'),
                              onClick: landing.onSignUpClick,
                              disabled: landing.signUpDisabled,
                          },
                          secondary: {
                              label: t('loginBtn'),
                              onClick: landing.onLoginClick,
                              loading: landing.isLoggingIn,
                              disabled: landing.isLoggingIn,
                          },
                      }
            }
            panelClassName={landing.blockSignup ? 'overflow-y-auto pb-6' : undefined}
        >
            {landing.blockSignup ? (
                <div className="flex flex-col gap-6">
                    {sub}
                    <LandingWebBlock
                        deviceType={landing.deviceType}
                        isLoggingIn={landing.isLoggingIn}
                        onLoginClick={landing.onLoginClick}
                        onSignUpClick={landing.onSignUpClick}
                        onStoreClick={(store) => landing.track('store_button', 'tap', store)}
                        accountDeletedCallout={accountDeletedCallout}
                        recoveryLink={recoveryLink}
                    />
                </div>
            ) : (
                // The sub line is centred between the seam and Sign up (on a small phone it sits 20 px under the seam,
                // above the lifted footer). The account-deleted callout takes its slot, and the recovery link is
                // pinned above Sign up, so neither moves the footer or the sub line.
                <div className="relative -mt-[var(--sr-panel-pad)] flex h-[calc(var(--sr-panel-to-cta)+var(--sr-panel-pad))] flex-col justify-center signup-sm:h-[calc(var(--sr-panel-to-cta)+var(--sr-panel-pad)-20px)] signup-sm:justify-start signup-sm:pt-5">
                    {accountDeletedCallout || sub}
                    {recoveryLink && (
                        <div
                            className="absolute bottom-4 left-0 signup-sm:bottom-2.5"
                            data-testid="landing-recovery-link"
                        >
                            {recoveryLink}
                        </div>
                    )}
                </div>
            )}
            <LoginRecoveryDrawer {...landing.recoveryDrawer} />
        </SetupScreen>
    )
}
