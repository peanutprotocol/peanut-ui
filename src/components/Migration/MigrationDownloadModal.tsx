'use client'
import { useEffect, useState } from 'react'
import posthog from 'posthog-js'
import { useTranslations } from 'next-intl'
import ActionModal from '@/components/Global/ActionModal'
import DownloadQR from '@/components/Migration/DownloadQR'
import { ANALYTICS_EVENTS, MODAL_TYPES } from '@/constants/analytics.consts'
import {
    DOWNLOAD_PROMPT_SNOOZE_DAYS,
    MIGRATION_SURFACES,
    MIGRATION_URGENCY_THRESHOLD_DAYS,
    STORE_NAME,
} from '@/constants/migration.consts'
import { getMigrationCutoverTime, openStore } from '@/utils/migration.utils'
import { DeviceType, useDeviceType } from '@/hooks/useGetDeviceType'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'
import { useAuth } from '@/context/authContext'
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
    forceVariant,
}: {
    onVisibilityChange?: (visible: boolean) => void
    /** Dev-surface override: render this variant unconditionally so the shot
     *  harness can photograph a sheet that otherwise gates itself on the
     *  PostHog flag, the cutover clock and the stored snooze. Never set in
     *  production code. */
    forceVariant?: 'early' | 'urgent'
}) {
    const t = useTranslations('migration')
    const migrationOn = useMigrationFlag()
    const { deviceType } = useDeviceType()
    const { user } = useAuth()
    const [visible, setVisible] = useState(false)

    const userId = user?.user.userId

    useEffect(() => {
        if (forceVariant) {
            setVisible(true)
            return
        }
        // sunset block owns post-cutover; every ineligible path clears state so
        // an already-shown modal disappears if the flag flips off mid-session
        if (!migrationOn || !userId || isCapacitor() || Date.now() >= getMigrationCutoverTime()) {
            setVisible(false)
            return
        }
        const snoozedAt = getUserPreferences(userId)?.migrationPromptSnoozedAt
        if (snoozedAt && Date.now() - new Date(snoozedAt).getTime() < SNOOZE_MS) {
            setVisible(false)
            return
        }
        setVisible(true)
        posthog.capture(ANALYTICS_EVENTS.MODAL_SHOWN, { modal_type: MODAL_TYPES.MIGRATION_DOWNLOAD })
    }, [migrationOn, userId, forceVariant])

    useEffect(() => {
        onVisibilityChange?.(visible)
    }, [visible, onVisibilityChange])

    const snooze = () => {
        setVisible(false)
        updateUserPreferences(userId, { migrationPromptSnoozedAt: new Date().toISOString() })
        posthog.capture(ANALYTICS_EVENTS.MODAL_DISMISSED, { modal_type: MODAL_TYPES.MIGRATION_DOWNLOAD })
    }

    const daysLeft = Math.max(1, Math.ceil((getMigrationCutoverTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    const isDesktop = deviceType === DeviceType.WEB
    const store = deviceType === DeviceType.ANDROID ? 'android' : 'ios'

    // two-phase copy: celebrate the app while the cutover is far, switch to
    // friendly urgency (deadline in the copy) for the final stretch
    const isUrgent = forceVariant ? forceVariant === 'urgent' : daysLeft <= MIGRATION_URGENCY_THRESHOLD_DAYS

    // desktop stacks it under the App Store + Google Play pair — a third CTA
    // steps down to ghost (kush ruling 2026-09-10); on phone it is the second
    // CTA and stays the stroke secondary
    const remindLaterCta = {
        text: t(isUrgent ? 'downloadPrompt.remindLater' : 'downloadPrompt.maybeLater'),
        variant: (isDesktop ? 'transparent' : 'stroke') as 'transparent' | 'stroke',
        onClick: snooze,
    }

    // both variants are modals (ruled 2026-09-10, kush): the download prompt is
    // urgent and demands attention for its whole window, not just the final
    // fortnight — the two-phase split only changes the copy
    return (
        <ActionModal
            visible={visible}
            onClose={snooze}
            icon="mobile-install"
            title={t(isUrgent ? 'downloadPrompt.title' : 'downloadPrompt.earlyTitle')}
            description={
                isUrgent ? t('downloadPrompt.description', { days: daysLeft }) : t('downloadPrompt.earlyDescription')
            }
            content={isDesktop ? <DownloadQR surface={MIGRATION_SURFACES.DOWNLOAD_MODAL} /> : undefined}
            ctaClassName="md:flex-col gap-4"
            ctas={
                isDesktop
                    ? [remindLaterCta]
                    : [
                          {
                              text: STORE_NAME[store],
                              variant: 'purple',
                              shadowSize: '4',
                              icon: store === 'ios' ? ('apple-logo' as const) : ('google-play' as const),
                              onClick: () => {
                                  posthog.capture(ANALYTICS_EVENTS.MODAL_CTA_CLICKED, {
                                      modal_type: MODAL_TYPES.MIGRATION_DOWNLOAD,
                                      cta: 'store',
                                  })
                                  openStore(store, MIGRATION_SURFACES.DOWNLOAD_MODAL)
                              },
                          },
                          remindLaterCta,
                      ]
            }
        />
    )
}
