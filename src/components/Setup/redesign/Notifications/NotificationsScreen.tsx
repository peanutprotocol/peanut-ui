'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Callout } from '@/components/0_Bruddle/Callout'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import type { StepComponentProps } from '@/components/Setup/Setup.types'
import { SetupScreen } from '@/components/Setup/redesign/shell/SetupScreen'
import { canOpenAppSettings } from '@/utils/native-settings'
import { NotificationsArt } from './NotificationsArt'
import { useNotificationsControl } from './useNotificationsControl'
import { SETUP_LEAD_CLASS } from '@/components/Setup/redesign/shell/shell.consts'

/**
 * 10 Notifications (step `notification-permission`): "Turn on notifications" and "Not now"; an OS refusal shows
 * `denied`. Contract P4 § 3.
 */
export function NotificationsScreen(_props: StepComponentProps) {
    const t = useTranslations('setupRedesign')
    const tNotifications = useTranslations('setup.notifications')
    const control = useNotificationsControl()
    const [ring, setRing] = useState(0)
    const busy = control.requesting || control.saving
    const denied = control.state === 'denied'
    // only where the link can work: off the native bridge it would do nothing
    const settingsLink = denied && canOpenAppSettings()

    return (
        <SetupScreen
            ground="pink"
            stage="std"
            artTop={192}
            title={t('notif.title')}
            art={<NotificationsArt ring={ring} />}
            state={control.state}
            footer={
                denied
                    ? {
                          primary: {
                              label: t('common.continue'),
                              testId: 'setup-redesign-primary',
                              loading: control.saving,
                              disabled: busy,
                              onClick: () => void control.goOn('continue'),
                          },
                          slot: settingsLink ? (
                              <span data-testid="setup-redesign-slot">
                                  {t.rich('notif.openSettings', {
                                      link: (chunks) => (
                                          <LinkButton onClick={control.openSettings}>{chunks}</LinkButton>
                                      ),
                                  })}
                              </span>
                          ) : undefined,
                      }
                    : {
                          primary: {
                              label: t('notif.cta'),
                              testId: 'setup-redesign-primary',
                              loading: busy,
                              disabled: busy,
                              onClick: () => {
                                  setRing((n) => n + 1)
                                  void control.turnOn()
                              },
                          },
                          slot: (
                              <span data-testid="setup-redesign-slot">
                                  <LinkButton onClick={() => void control.goOn('not_now')} disabled={busy}>
                                      {t('common.notNow')}
                                  </LinkButton>
                              </span>
                          ),
                      }
            }
        >
            <div data-testid="setup-redesign-notifications" data-setup-state={control.state}>
                <p className={SETUP_LEAD_CLASS}>{t('notif.desc')}</p>
                {denied && (
                    <Callout priority="info" className="mt-4 signup-sm:mt-3">
                        {t('notif.denied')}
                    </Callout>
                )}
                {control.saveFailed && (
                    <Callout priority="error" className="mt-4 signup-sm:mt-3">
                        {tNotifications('saveFailed')}
                    </Callout>
                )}
            </div>
        </SetupScreen>
    )
}
