'use client'

import { useTranslations } from 'next-intl'
import { Callout } from '@/components/0_Bruddle/Callout'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Toggle } from '@/components/0_Bruddle/Toggle'
import type { IconName } from '@/components/Global/Icons/Icon'
import { SetupScreen } from '@/components/Setup/redesign/shell/SetupScreen'
import type { SwitchesVariant } from '@/features/setup/notificationsExperiment'
import { NotificationsArt } from './NotificationsArt'
import { type NotificationSwitch, useNotificationSwitches } from './useNotificationSwitches'
import { SETUP_LEAD_CLASS } from '@/components/Setup/redesign/shell/shell.consts'

const SWITCHES: { key: NotificationSwitch; icon: IconName; label: 'important' | 'offers' | 'email' }[] = [
    { key: 'push', icon: 'bell', label: 'important' },
    { key: 'marketingPush', icon: 'gift', label: 'offers' },
    { key: 'emailUpdates', icon: 'mail', label: 'email' },
]

/**
 * 10 Notifications, the experiment's switch arms (`switches`, `defaults_on`): dev's three switch rows and
 * behaviour on the redesign's stage and footer. No mock still: the list scrolls in the panel above the button.
 */
export function NotificationsSwitchesScreen({ variant }: { variant: SwitchesVariant }) {
    const t = useTranslations('setupRedesign')
    const tNotifications = useTranslations('setup.notifications')
    const { notificationChoices, anyOn, saving, failed, toggle, save } = useNotificationSwitches(variant)
    const state = failed ? 'switches-save-failed' : 'switches'

    return (
        <SetupScreen
            ground="pink"
            stage="std"
            artTop={192}
            title={t('notif.title')}
            art={<NotificationsArt ring={0} />}
            state={state}
            footer={{
                primary: {
                    label: t('common.continue'),
                    testId: 'setup-redesign-primary',
                    loading: saving,
                    disabled: saving || !anyOn,
                    onClick: () => void save(false),
                },
                slot: (
                    <span data-testid="setup-redesign-slot">
                        <LinkButton onClick={() => void save(true)} disabled={saving}>
                            {t('common.notNow')}
                        </LinkButton>
                    </span>
                ),
            }}
        >
            <div
                className="flex flex-col gap-3 overflow-y-auto pb-4"
                style={{ maxHeight: 'calc(var(--sr-panel-to-cta) - 8px)' }}
                data-testid="setup-redesign-notifications"
                data-setup-state={state}
            >
                <p className={SETUP_LEAD_CLASS}>{t('notif.desc')}</p>
                {/* A toggle row sets a preference, so its bubble is blue (design.md icon bubble ruling). */}
                <ListGroup>
                    {SWITCHES.map(({ key, icon, label }) => (
                        <ListItem
                            key={key}
                            className="py-3"
                            title={tNotifications(`${label}Label`)}
                            body={tNotifications(`${label}Description`)}
                            bodyWrap
                            leading={<IconBubble icon={icon} size="s" color="blue" />}
                            trailing={
                                <Toggle
                                    aria-label={tNotifications(`${label}Label`)}
                                    checked={notificationChoices[key]}
                                    onChange={(on) => toggle(key, on)}
                                    disabled={saving}
                                />
                            }
                        />
                    ))}
                </ListGroup>
                <p className="text-body-xs text-foreground-secondary">{tNotifications('changeAnytime')}</p>
                {failed && <Callout priority="error">{tNotifications('saveFailed')}</Callout>}
            </div>
        </SetupScreen>
    )
}
