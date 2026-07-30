'use client'
import { useEffect, useState } from 'react'
import posthog from 'posthog-js'
import { useTranslations } from 'next-intl'
import ActionModal from '@/components/Global/ActionModal'
import DownloadQR from '@/components/Migration/DownloadQR'
import { openStore } from '@/utils/migration.utils'
import { ANALYTICS_EVENTS, MODAL_TYPES } from '@/constants/analytics.consts'
import {
    DOWNLOAD_PROMPT_SNOOZE_DAYS,
    MIGRATION_CUTOVER_DATE,
    MIGRATION_SURFACES,
    STORE_NAME,
} from '@/constants/migration.consts'
import { DeviceType, useDeviceType } from '@/hooks/useGetDeviceType'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'
import { useUserStore } from '@/redux/hooks'
import { isCapacitor } from '@/utils/capacitor'
import { getUserPreferences, updateUserPreferences } from '@/utils/general.utils'

const SNOOZE_MS = DOWNLOAD_PROMPT_SNOOZE_DAYS * 24 * 60 * 60 * 1000

/**
 * Post-login "Peanut is becoming an app" prompt (TASK-20826), shown on the
 * web app during the migration notice window (flag on, cutover not reached).
 * Self-gating; reports visibility so home can suppress lower-priority modals.
 */
export default function MigrationDownloadModal({
    onVisibilityChange,
}: {
    onVisibilityChange?: (visible: boolean) => void
}) {
    const t = useTranslations('migration')
    const migrationOn = useMigrationFlag()
    const { deviceType } = useDeviceType()
    const { user } = useUserStore()
    const [visible, setVisible] = useState(false)

    const userId = user?.user.userId

    useEffect(() => {
        if (!migrationOn || !userId || isCapacitor()) return
        if (Date.now() >= MIGRATION_CUTOVER_DATE.getTime()) return // sunset block owns post-cutover
        const snoozedAt = getUserPreferences(userId)?.migrationPromptSnoozedAt
        if (snoozedAt && Date.now() - new Date(snoozedAt).getTime() < SNOOZE_MS) return
        setVisible(true)
        posthog.capture(ANALYTICS_EVENTS.MODAL_SHOWN, { modal_type: MODAL_TYPES.MIGRATION_DOWNLOAD })
    }, [migrationOn, userId])

    useEffect(() => {
        onVisibilityChange?.(visible)
    }, [visible, onVisibilityChange])

    const snooze = () => {
        setVisible(false)
        updateUserPreferences(userId, { migrationPromptSnoozedAt: new Date().toISOString() })
        posthog.capture(ANALYTICS_EVENTS.MODAL_DISMISSED, { modal_type: MODAL_TYPES.MIGRATION_DOWNLOAD })
    }

    const daysLeft = Math.max(1, Math.ceil((MIGRATION_CUTOVER_DATE.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    const isDesktop = deviceType === DeviceType.WEB
    const store = deviceType === DeviceType.ANDROID ? 'android' : 'ios'

    return (
        <ActionModal
            visible={visible}
            onClose={snooze}
            icon="mobile-install"
            title={t('downloadPrompt.title')}
            description={t('downloadPrompt.description', { days: daysLeft })}
            content={isDesktop ? <DownloadQR surface={MIGRATION_SURFACES.DOWNLOAD_MODAL} /> : undefined}
            ctas={
                isDesktop
                    ? []
                    : [
                          {
                              text: STORE_NAME[store],
                              variant: 'purple',
                              shadowSize: '4',
                              icon: 'mobile-install',
                              onClick: () => {
                                  posthog.capture(ANALYTICS_EVENTS.MODAL_CTA_CLICKED, {
                                      modal_type: MODAL_TYPES.MIGRATION_DOWNLOAD,
                                      cta: 'store',
                                  })
                                  openStore(store, MIGRATION_SURFACES.DOWNLOAD_MODAL)
                              },
                          },
                      ]
            }
            footer={
                <button className="mt-3 w-full text-center text-xs text-grey-1 underline" onClick={snooze}>
                    {t('downloadPrompt.remindLater')}
                </button>
            }
        />
    )
}
