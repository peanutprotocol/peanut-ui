'use client'
import { useEffect, useRef, useState } from 'react'
import posthog from 'posthog-js'
import { useTranslations } from 'next-intl'
import ActionModal from '@/components/Global/ActionModal'
import DownloadQR from '@/components/Migration/DownloadQR'
import { ANALYTICS_EVENTS, MODAL_TYPES } from '@/constants/analytics.consts'
import { DOWNLOAD_PROMPT_SNOOZE_DAYS, MIGRATION_SURFACES, STORE_NAME } from '@/constants/migration.consts'
import { openStore, storeForDevice, storeIcon } from '@/utils/migration.utils'
import { useDeviceType } from '@/hooks/useGetDeviceType'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'
import { useAuth } from '@/context/authContext'
import { useModalsContextOptional } from '@/context/ModalsContext'
import { isCapacitor } from '@/utils/capacitor'
import { getUserPreferences, updateUserPreferences } from '@/utils/general.utils'

const SNOOZE_MS = DOWNLOAD_PROMPT_SNOOZE_DAYS * 24 * 60 * 60 * 1000

/**
 * Post-login "The Peanut app is here" prompt (TASK-20826), shown on the web
 * app while the pwa-sunset flag is on. The web app stays available, so the
 * prompt has no deadline and "Maybe later" snoozes it.
 * Self-gating; reports visibility so home can suppress lower-priority modals.
 */
export default function MigrationDownloadModal({
    onVisibilityChange,
    forceVisible,
}: {
    onVisibilityChange?: (visible: boolean) => void
    /** Dev-surface override: render unconditionally so the shot harness can
     *  photograph a sheet that otherwise gates itself on the PostHog flag and
     *  the stored snooze. Never set in production code. */
    forceVisible?: boolean
}) {
    const t = useTranslations('migration')
    const migrationOn = useMigrationFlag()
    const { deviceType } = useDeviceType()
    const { user } = useAuth()
    const [visible, setVisible] = useState(false)

    const userId = user?.user.userId
    // optional hook on purpose: this component renders provider-less in its
    // own tests and the dev shot surface — no gate there, no throw
    const legalConsentGate = useModalsContextOptional()?.legalConsentGate
    // legal outranks the download prompt. blocked while the consent check is
    // in flight or its modal is up — AND while the gate's resolution belongs
    // to a different account (on a switch, the previous account's 'clear'
    // must not release this one before its own check publishes). a null
    // gate userId is account-independent: logged out or no consent surface.
    const legalBlocking =
        !!legalConsentGate &&
        (legalConsentGate.status !== 'clear' ||
            (legalConsentGate.userId !== null && legalConsentGate.userId !== (userId ?? null)))
    // a legal prompt actually SHOWN to this account defers the download
    // prompt to the next visit entirely — resolving legal must not pop a
    // second modal. a mere no-change status check never latches, and the
    // latch is per account so a switch starts fresh.
    const legalPromptSeenFor = useRef<string | null>(null)
    if (legalConsentGate?.status === 'prompting' && legalConsentGate.userId && legalConsentGate.userId === userId) {
        legalPromptSeenFor.current = userId
    }

    // `visible` state alone is not enough to render by: it only updates in
    // an effect, so during the first render(s) after an account switch the
    // PREVIOUS account's true would commit under the new one. the render
    // gates synchronously on the current account + gate instead, and the
    // ref records which account the visible state was decided for.
    const visibleFor = useRef<string | null>(null)

    useEffect(() => {
        if (forceVisible) {
            setVisible(true)
            return
        }
        if (legalBlocking || (!!userId && legalPromptSeenFor.current === userId)) {
            setVisible(false)
            return
        }
        // every ineligible path clears state so an already-shown modal
        // disappears if the flag flips off mid-session
        if (!migrationOn || !userId || isCapacitor()) {
            setVisible(false)
            return
        }
        const snoozedAt = getUserPreferences(userId)?.migrationPromptSnoozedAt
        if (snoozedAt && Date.now() - new Date(snoozedAt).getTime() < SNOOZE_MS) {
            setVisible(false)
            return
        }
        visibleFor.current = userId
        setVisible(true)
        posthog.capture(ANALYTICS_EVENTS.MODAL_SHOWN, { modal_type: MODAL_TYPES.MIGRATION_DOWNLOAD })
    }, [migrationOn, userId, forceVisible, legalBlocking])

    // the committed visibility: the stored decision, only while it still
    // belongs to the current account and legal is not blocking it
    const renderVisible =
        !!forceVisible ||
        (visible &&
            visibleFor.current === (userId ?? null) &&
            !legalBlocking &&
            !(!!userId && legalPromptSeenFor.current === userId))

    useEffect(() => {
        onVisibilityChange?.(renderVisible)
    }, [renderVisible, onVisibilityChange])

    const snooze = () => {
        setVisible(false)
        updateUserPreferences(userId, { migrationPromptSnoozedAt: new Date().toISOString() })
        posthog.capture(ANALYTICS_EVENTS.MODAL_DISMISSED, { modal_type: MODAL_TYPES.MIGRATION_DOWNLOAD })
    }

    const store = storeForDevice(deviceType)

    // a defer action: the tertiary link on every device (ruled 2026-09-25,
    // hugo — reverses the 2026-09-10 ghost/secondary split)
    const remindLaterCta = {
        text: t('downloadPrompt.maybeLater'),
        onClick: snooze,
    }

    return (
        <ActionModal
            visible={renderVisible}
            onClose={snooze}
            tone="peanut"
            icon="mobile-install"
            title={t('downloadPrompt.earlyTitle')}
            description={t('downloadPrompt.earlyDescription')}
            content={!store ? <DownloadQR surface={MIGRATION_SURFACES.DOWNLOAD_MODAL} /> : undefined}
            ctaClassName="md:flex-col gap-4"
            tertiaryCta={remindLaterCta}
            ctas={
                !store
                    ? undefined
                    : [
                          {
                              text: STORE_NAME[store],
                              variant: 'primary',
                              shadowSize: '4',
                              icon: storeIcon(store),
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
        />
    )
}
