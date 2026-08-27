/**
 * One field list, three sinks.
 *
 * The web widget, the proxy iframe and the native `setString` loop each write
 * the agent sidebar, and when they were written out by hand they drifted: native
 * sent two keys where web sent seven, so the agents helping *app* users saw the
 * least. `supportSessionFields` is now the single definition; these tests pin
 * the properties that made the drift damaging.
 */

import { supportSessionFields, nativeCrispFields } from '../crisp'
import type { CrispUserData } from '@/hooks/useCrispUserData'

const userData = (partial: Partial<CrispUserData> = {}): CrispUserData =>
    ({
        username: 'glorfindel',
        userId: 'user-1',
        balance: '$100.00 spendable (wallet $100.00 · card $0.00)',
        emailOnFile: true,
        segments: ['ios-native', 'kyc-verified'],
        ...partial,
    }) as CrispUserData

describe('supportSessionFields', () => {
    it('feeds the native sink from the identical list', () => {
        expect(nativeCrispFields).toBe(supportSessionFields)
    })

    /*
     * Absent values must still be written. A device-local Crisp session
     * (native) keeps whatever was last set, so skipping an empty key would leave
     * the previous user's balance and verification state visible to an agent
     * after a logout/login on a shared device.
     */
    it('writes every key on every call, empty rather than omitted', () => {
        const full = supportSessionFields(userData())
        const sparse = supportSessionFields({ segments: [] } as unknown as CrispUserData)

        expect(sparse.map(([key]) => key)).toEqual(full.map(([key]) => key))
        expect(sparse.every(([, value]) => typeof value === 'string')).toBe(true)
        expect(Object.fromEntries(sparse).balance).toBe('')
    })

    it('renders email_on_file as a word an agent can read, and distinguishes unknown', () => {
        expect(Object.fromEntries(supportSessionFields(userData({ emailOnFile: true }))).email_on_file).toBe('yes')
        expect(Object.fromEntries(supportSessionFields(userData({ emailOnFile: false }))).email_on_file).toBe('no')
        expect(Object.fromEntries(supportSessionFields(userData({ emailOnFile: undefined }))).email_on_file).toBe('')
    })

    it('carries the full segment list as a data row for the native sink', () => {
        expect(Object.fromEntries(supportSessionFields(userData())).segments).toBe('ios-native kyc-verified')
    })

    it('includes the account context an agent would otherwise have to ask for', () => {
        const keys = supportSessionFields(userData()).map(([key]) => key)
        expect(keys).toEqual(
            expect.arrayContaining([
                'balance',
                'account_stats',
                'latest_activity',
                'limits_remaining',
                'card',
                'linked_accounts',
                'app_context',
                'sentry_issues',
            ])
        )
    })
})
