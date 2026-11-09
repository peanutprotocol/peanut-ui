import { isUsableSavedAccount } from '@/utils/bridge-accounts.utils'

describe('isUsableSavedAccount', () => {
    it.each(['not_owned_by_current_bridge_customer', 'bridge_account_replacement_pending', 'removed_by_support'])(
        'hides an account the API switched off until it is added again (%s)',
        (deactivationReason) => {
            expect(isUsableSavedAccount({ deactivationReason })).toBe(false)
        }
    )

    it.each([undefined, null, '', 'RETURNED', 'deactivated'])(
        'keeps an account without a re-add reason (%p)',
        (deactivationReason) => {
            expect(isUsableSavedAccount({ deactivationReason })).toBe(true)
        }
    )
})
