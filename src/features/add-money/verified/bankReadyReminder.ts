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
 * money and is not in a task. Empty: no reminder. `shown` undefined is the first load since this shipped: the
 * accounts ready then are recorded, not announced (Kush: no wave for accounts that opened long ago).
 */
export function bankReadyReminder(input: {
    ready: readonly string[]
    shown: readonly string[] | undefined
    addedMoney: boolean
    inTask: boolean
}): string[] {
    if (!input.shown || input.addedMoney || input.inTask) return []
    return input.ready.filter((id) => !input.shown!.includes(id))
}

/** undefined: nothing recorded for this person on this device yet */
export const shownBankReady = (userId: string): string[] | undefined => getUserPreferences(userId)?.bankReadyShown

/** records the ids; the first call writes even an empty list, so a later account counts as new */
export function markBankReadyShown(userId: string, ids: readonly string[]): void {
    const shown = shownBankReady(userId)
    const added = ids.filter((id) => !shown?.includes(id))
    if (!shown || added.length) updateUserPreferences(userId, { bankReadyShown: [...(shown ?? []), ...added] })
}
