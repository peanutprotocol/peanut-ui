'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useAuth } from '@/context/authContext'
import { useAttentionOptional } from '@/features/attention/AttentionProvider'
import { useCapabilities } from '@/hooks/useCapabilities'
import { hasInAppHistory } from '@/hooks/useSafeBack'
import { trackAddMoney } from '../analytics'
import {
    BANK_READY_PAGE,
    bankReadyReminder,
    markBankReadyShown,
    readyAccountIds,
    shownBankReady,
} from './bankReadyReminder'

// one chance per app load: home is the first screen of the load (an app open, not a return from a task),
// and the chance ends when home is left, so coming back to home after a task never opens the page
let chance: 'unknown' | 'open' | 'spent' = 'unknown'

/**
 * On Home: when a bank account opened since the person last saw it ready, and they never added money, open
 * "Your bank is ready" once (add-money proposal, rule 4). `addedMoney` is undefined while the balance loads.
 */
export function useBankReadyReminder(addedMoney: boolean | undefined) {
    const router = useRouter()
    const { user } = useAuth()
    const userId = user?.user.userId
    const { capabilities } = useCapabilities()
    // a drawer, modal or the scanner is open on home: the person is doing something
    const busy = useAttentionOptional()?.session.busy ?? false

    useEffect(() => {
        if (chance === 'unknown') chance = hasInAppHistory() ? 'spent' : 'open'
        return () => {
            chance = 'spent'
        }
    }, [])

    const report = capabilities.features
    useEffect(() => {
        if (!userId || addedMoney === undefined || !report) return
        const accounts = bankReadyReminder({
            ready: readyAccountIds(report),
            shown: shownBankReady(userId),
            addedMoney,
            inTask: chance !== 'open' || busy,
        })
        if (!accounts.length) return
        chance = 'spent'
        markBankReadyShown(userId, accounts)
        trackAddMoney(ANALYTICS_EVENTS.VERIFIED_PAGE_RESHOWN, { accounts })
        router.replace(BANK_READY_PAGE)
    }, [userId, addedMoney, report, busy, router])
}

/** tests only: a new app load */
export function resetBankReadyReminderForTests(): void {
    chance = 'unknown'
}
