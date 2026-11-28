import { takeReshowing } from '@/features/add-money/verified/bankReadyReminder'
import { reminderLoad } from '@/features/add-money/verified/useBankReadyReminder'

/** a new app load for the bank-ready reminder: its one chance back, no hand-off to the page pending */
export function resetBankReadyReminder(): void {
    reminderLoad.chance = 'unknown'
    takeReshowing()
}
