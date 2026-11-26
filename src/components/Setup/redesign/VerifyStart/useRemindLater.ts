'use client'

import { useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { updateUserById } from '@/app/actions/users'
import { useToast } from '@/components/0_Bruddle/Toast'
import { useAuth } from '@/context/authContext'
import * as Sentry from '@/utils/sentry-lazy'

/** the hour, on the user's clock, that "Remind me later" schedules for */
export const REMIND_LATER_HOUR = 9

/** Every caller sits in front of the ID check: the reminder is for the verify step. */
export const REMIND_LATER_STEP = 'verify'

/** Tomorrow at 09:00 on the device's clock: well inside the API's 30-day reminder limit. */
export function tomorrowMorning(now: Date): Date {
    const at = new Date(now)
    at.setDate(at.getDate() + 1)
    at.setHours(REMIND_LATER_HOUR, 0, 0, 0)
    return at
}

/**
 * "Remind me later" (TASK-22683, api#2307): the nudge engine sends the verify step's next nudge at tomorrow morning.
 * It has its own ledger key, `attentionLedger.reminder` ({ step, remindAt, updatedAt }), and never snoozes the
 * checklist ask, so Home's checklist stays visible. The profile write is awaited, not left to the ledger's debounced
 * device sync, so the toast only promises a reminder the API holds. The caller leaves the screen at once: the toast
 * outlives it.
 */
export function useRemindLater(): () => Promise<boolean> {
    const t = useTranslations('setupRedesign.verifyStart')
    const toast = useToast()
    const userId = useAuth().user?.user.userId

    return useCallback(async () => {
        if (!userId) return false
        const now = new Date()
        const at = tomorrowMorning(now)
        const result = await updateUserById({
            userId,
            attentionLedger: {
                reminder: { step: REMIND_LATER_STEP, remindAt: at.toISOString(), updatedAt: now.toISOString() },
            },
        })
        if (result.error) {
            // offline is normal; an answered failure means the API refused the snooze
            if (result.failureKind === 'http')
                Sentry.captureMessage('remind me later: reminder write failed', {
                    level: 'warning',
                    extra: { status: result.status, error: result.error },
                })
            toast.error(t('remindFailed'))
            return false
        }
        toast.success(t('remindSet', { at }))
        return true
    }, [userId, t, toast])
}
