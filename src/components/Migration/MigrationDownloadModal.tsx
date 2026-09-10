'use client'
import { useEffect, useState } from 'react'
import posthog from 'posthog-js'
import { useTranslations } from 'next-intl'
import ActionModal from '@/components/Global/ActionModal'
import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
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
}: {
    onVisibilityChange?: (visible: boolean) => void
}) {
    const t = useTranslations('migration')
    const migrationOn = useMigrationFlag()
    const { deviceType } = useDeviceType()
    const { user } = useAuth()
    const [visible, setVisible] = useState(false)

    const userId = user?.user.userId

    useEffect(() => {
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
    }, [migrationOn, userId])

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
    const isUrgent = daysLeft <= MIGRATION_URGENCY_THRESHOLD_DAYS

    const remindLaterCta = {
        text: t(isUrgent ? 'downloadPrompt.remindLater' : 'downloadPrompt.maybeLater'),
        variant: 'stroke' as const,
        onClick: snooze,
    }

    // the urgent-deadline stretch is a real interruption and stays a modal;
    // the early promo nag is not urgent, so it rides in a drawer (rule: modal
    // only for content that demands immediate attention)
    if (isUrgent) {
        return (
            <ActionModal
                visible={visible}
                onClose={snooze}
                icon="mobile-install"
                title={t('downloadPrompt.title')}
                description={t('downloadPrompt.description', { days: daysLeft })}
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

    return (
        <Drawer
            open={visible}
            onOpenChange={(open) => {
                if (!open) snooze()
            }}
        >
            <DrawerContent>
                <div className="flex flex-col items-center pt-1 pb-6 text-center">
                    {/* the head owns the M/12 beneath it; everything after it
                        keeps the drawer's L/16 rhythm */}
                    <div className="mb-3 flex w-full flex-col items-center gap-4">
                        <IconBubble icon="mobile-install" className="bg-action-primary" />
                        <DrawerHeader className="w-full gap-2 p-0 text-center sm:text-center">
                            <DrawerTitle>{t('downloadPrompt.earlyTitle')}</DrawerTitle>
                            <DrawerDescription>{t('downloadPrompt.earlyDescription')}</DrawerDescription>
                        </DrawerHeader>
                    </div>
                    <div className="flex w-full flex-col items-center gap-4">
                        {isDesktop ? (
                            <DownloadQR surface={MIGRATION_SURFACES.DOWNLOAD_MODAL} />
                        ) : (
                            <Button
                                variant="purple"
                                shadowSize="4"
                                icon={store === 'ios' ? 'apple-logo' : 'google-play'}
                                className="w-full justify-center"
                                onClick={() => {
                                    posthog.capture(ANALYTICS_EVENTS.MODAL_CTA_CLICKED, {
                                        modal_type: MODAL_TYPES.MIGRATION_DOWNLOAD,
                                        cta: 'store',
                                    })
                                    openStore(store, MIGRATION_SURFACES.DOWNLOAD_MODAL)
                                }}
                            >
                                {STORE_NAME[store]}
                            </Button>
                        )}
                        <Button variant="stroke" className="w-full justify-center" onClick={snooze}>
                            {t('downloadPrompt.maybeLater')}
                        </Button>
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    )
}
