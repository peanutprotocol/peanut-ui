import type { FeatureReport } from '@/types/capabilities'
import { getUserPreferences, updateUserPreferences } from '@/utils/general.utils'

/** the page the reminder and the kyc.bank_ready push open (add-money proposal, rule 4) */
export const BANK_READY_PAGE = '/verified?variant=bank-ready'

/** the bank and local accounts that take money now, by id: `bank.USD`, `local.ARS` */
export function readyAccountIds(report: FeatureReport | undefined): string[] {
    if (!report) return []
    return (['bank', 'local'] as const).flatMap((feature) =>
        Object.entries(report[feature].accounts)
            .filter(([, account]) => account.state === 'on')
            .map(([currency]) => `${feature}.${currency}`)
    )
}

/**
 * The accounts the reminder announces: ready, not shown on this device before, for a person who never added
 * money and is not in a task. Empty: no reminder.
 */
export function bankReadyReminder(input: {
    ready: readonly string[]
    shown: readonly string[]
    addedMoney: boolean
    inTask: boolean
}): string[] {
    if (input.addedMoney || input.inTask) return []
    return input.ready.filter((id) => !input.shown.includes(id))
}

export const shownBankReady = (userId: string): string[] => getUserPreferences(userId)?.bankReadyShown ?? []

export function markBankReadyShown(userId: string, ids: readonly string[]): void {
    const shown = shownBankReady(userId)
    const added = ids.filter((id) => !shown.includes(id))
    if (added.length) updateUserPreferences(userId, { bankReadyShown: [...shown, ...added] })
}
