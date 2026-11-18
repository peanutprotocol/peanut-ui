'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { LINK_BUTTON_CLASSES } from '@/components/0_Bruddle/LinkButton'
import { SetupDocLink } from '@/components/Setup/components/SetupDocsDrawer'
import type { StepComponentProps } from '@/components/Setup/Setup.types'
import { SetupScreen } from '@/components/Setup/redesign/shell/SetupScreen'
import { EmailArt } from './EmailArt'
import { EmailField } from './EmailField'
import { EmailSuggestion } from './EmailSuggestion'
import { CHIP_MARKERS } from '@/components/Setup/redesign/Invite/suggestion-line'
import { useEmailStep } from './useEmailStep'
import { SETUP_LEAD_CLASS } from '@/components/Setup/redesign/shell/shell.consts'

/**
 * 09 Email (step `notification-email`): Peanut needs an email, one field, Continue once the address is valid.
 * No back arrow: the account exists, so this is the back-lock screen. The screen hides Back itself, so a resumed or
 * rendered-alone 09 never shows it either. Contract P4 § 2, conflict 9.
 */
export function EmailScreen(_props: StepComponentProps) {
    const t = useTranslations('setupRedesign')
    const tSetup = useTranslations('setup')
    const step = useEmailStep()
    const inputRef = useRef<HTMLInputElement>(null)
    const [beat, setBeat] = useState(0)
    const wasValid = useRef(step.valid)

    // event beat, once per new valid address: the badge pops
    useEffect(() => {
        if (step.valid && !wasValid.current) setBeat((n) => n + 1)
        wasValid.current = step.valid
    }, [step.valid])

    const message =
        step.mode === 'invalid'
            ? t('email.invalid')
            : step.mode === 'taken'
              ? t('email.taken')
              : step.mode === 'failed'
                ? t('email.saveFailed')
                : step.mode === 'not-ready'
                  ? tSetup('email.notReady')
                  : undefined

    const note = <p className="mt-2 w-full border-t border-border-subtle pt-3">{t('email.note')}</p>
    const taken = step.mode === 'taken' && !step.saving

    return (
        <SetupScreen
            ground="yellow"
            stage="std"
            artTop={190}
            title={t('email.title')}
            chrome={{ back: false }}
            art={<EmailArt beat={beat} />}
            state={step.state}
            footer={
                taken
                    ? {
                          // v7 etaken: an established account holds it, so log in to it first, then recover it
                          primary: {
                              label: t('email.logIn'),
                              testId: 'setup-redesign-primary',
                              loading: step.isLoggingIn,
                              disabled: step.isLoggingIn,
                              onClick: () => void step.logIn(),
                          },
                          // the recovery page ends with Contact support, so a failed log-in needs no line of its own
                          slot: (
                              <span className="self-start pt-6" data-testid="setup-redesign-slot">
                                  <SetupDocLink
                                      kind="account-recovery"
                                      href="/en/help/account-recovery"
                                      className={LINK_BUTTON_CLASSES}
                                  >
                                      {t('email.recover')}
                                  </SetupDocLink>
                              </span>
                          ),
                          // the button keeps the height it has under the note in the other states
                          reserve: note,
                      }
                    : {
                          primary: {
                              label: t('common.continue'),
                              testId: 'setup-redesign-primary',
                              loading: step.saving,
                              disabled: step.saving || !step.canContinue,
                              onClick: () => void step.save(),
                          },
                          slot: (
                              <span className="w-full" data-testid="setup-redesign-slot">
                                  {note}
                              </span>
                          ),
                      }
            }
        >
            <form
                noValidate
                className="flex flex-col"
                data-testid="setup-redesign-email"
                data-setup-state={step.state}
                onSubmit={(event) => {
                    event.preventDefault()
                    if (taken) return
                    void step.save()
                }}
            >
                <p className={SETUP_LEAD_CLASS}>{t('email.desc')}</p>
                <EmailField
                    ref={inputRef}
                    label={t('email.label')}
                    placeholder={t('email.placeholder')}
                    clearLabel={t('email.clearAria')}
                    value={step.email}
                    mode={step.mode}
                    valid={step.valid}
                    disabled={step.saving}
                    message={message}
                    status={
                        step.keepCurrentEmail
                            ? tSetup('notifications.changeAnytime')
                            : step.mode === 'deferred'
                              ? t('email.deferred')
                              : undefined
                    }
                    onChange={step.change}
                    onBlur={step.blur}
                    hint={
                        step.suggestion && (
                            <EmailSuggestion
                                line={t('email.suggest', { a: CHIP_MARKERS.a })}
                                address={step.suggestion}
                                onPick={() => {
                                    step.acceptSuggestion()
                                    inputRef.current?.focus()
                                }}
                            />
                        )
                    }
                />
            </form>
        </SetupScreen>
    )
}
