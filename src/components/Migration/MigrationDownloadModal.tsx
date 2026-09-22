'use client'
import { useEffect, useRef, useState } from 'react'
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
import { useModalsContextOptional } from '@/context/ModalsContext'
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
        if (forceVariant) {
            setVisible(true)
            return
        }
        if (legalBlocking || (!!userId && legalPromptSeenFor.current === userId)) {
            setVisible(false)
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
        visibleFor.current = userId
        setVisible(true)
        posthog.capture(ANALYTICS_EVENTS.MODAL_SHOWN, { modal_type: MODAL_TYPES.MIGRATION_DOWNLOAD })
    }, [migrationOn, userId, forceVariant, legalBlocking])

    // the committed visibility: the stored decision, only while it still
    // belongs to the current account and legal is not blocking it
    const renderVisible =
        !!forceVariant ||
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

    const daysLeft = Math.max(1, Math.ceil((getMigrationCutoverTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    const isDesktop = deviceType === DeviceType.WEB
    const store = deviceType === DeviceType.ANDROID ? 'android' : 'ios'

    // two-phase copy: celebrate the app while the cutover is far, switch to
    // friendly urgency (deadline in the copy) for the final stretch
    const isUrgent = forceVariant ? forceVariant === 'urgent' : daysLeft <= MIGRATION_URGENCY_THRESHOLD_DAYS

    // desktop stacks it under the App Store + Google Play pair — a third CTA
    // steps down to ghost (kush ruling 2026-09-10); on phone it is the second
    // CTA and stays the secondary
    const remindLaterCta = {
        text: t(isUrgent ? 'downloadPrompt.remindLater' : 'downloadPrompt.maybeLater'),
        variant: (isDesktop ? 'ghost' : 'secondary') as 'ghost' | 'secondary',
        onClick: snooze,
    }

    // both variants are modals (ruled 2026-09-10, kush): the download prompt is
    // urgent and demands attention for its whole window, not just the final
    // fortnight — the two-phase split only changes the copy
    return (
        <ActionModal
            visible={renderVisible}
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
                              variant: 'primary',
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
