'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/authContext'
import { useAttentionOptional } from '@/features/attention/AttentionProvider'
import { useCapabilities } from '@/hooks/useCapabilities'
import { hasInAppHistory } from '@/hooks/useSafeBack'
import {
    BANK_READY_PAGE,
    bankReadyReminder,
    markBankReadyShown,
    markReshowing,
    readyAccountIds,
    rowAccountIds,
    shownBankReady,
} from './bankReadyReminder'

// one chance per app load: home is the first screen of the load (an app open, not a return from a task). It
// ends with the first decision made from every input, whatever it says (Kush, D1: the next app open only), or
// when home is left, so a capability refresh mid-visit or a return from a task never opens the page.
// module state, so it holds only because reactStrictMode is false (next.config.js): a strict double mount would
// run the cleanup below and spend the chance before the first decision.
export const reminderLoad: { chance: 'unknown' | 'open' | 'spent' } = { chance: 'unknown' }

/**
 * On Home: when a bank account opened since the person last saw it ready, and they never added money, open
 * "Your bank is ready" once (add-money proposal, rule 4). `addedMoney` is undefined while the balance loads,
 * `methods` (the Add picker rows) while they load: only an account the page has a row for counts.
 */
export function useBankReadyReminder(addedMoney: boolean | undefined, methods: readonly string[] | undefined) {
    const router = useRouter()
    const { user } = useAuth()
    const userId = user?.user.userId
    const { capabilities } = useCapabilities()
    // a drawer, modal or the scanner is open on home: the person is doing something
    const busy = useAttentionOptional()?.session.busy ?? false

    useEffect(() => {
        if (reminderLoad.chance === 'unknown') reminderLoad.chance = hasInAppHistory() ? 'spent' : 'open'
        return () => {
            reminderLoad.chance = 'spent'
        }
    }, [])

    const report = capabilities.features
    useEffect(() => {
        if (reminderLoad.chance !== 'open' || !userId || !report || !methods) return
        const ready = rowAccountIds(readyAccountIds(report), methods)
        const shown = shownBankReady(userId)
        // first load since this shipped: what is ready now was ready before, record it and announce nothing
        if (!shown) {
            reminderLoad.chance = 'spent'
            markBankReadyShown(userId, ready)
            return
        }
        if (addedMoney === undefined) return
        // every input is read: this is the load's one decision
        reminderLoad.chance = 'spent'
        const accounts = bankReadyReminder({ ready, shown, addedMoney, inTask: busy })
        if (!accounts.length) return
        // the page records the accounts and reports the re-show once it shows
        markReshowing(accounts)
        router.replace(BANK_READY_PAGE)
        // methods by value: the picker list is a new array on every render
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, addedMoney, report, busy, router, methods?.join()])
}
