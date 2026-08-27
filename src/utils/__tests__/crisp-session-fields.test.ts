/**
 * One field list, three sinks.
 *
 * The web widget, the proxy iframe and the native `setString` loop each write
 * the agent sidebar, and when they were written out by hand they drifted: native
 * sent two keys where web sent seven, so the agents helping *app* users saw the
 * least. `supportSessionFields` is now the single definition; these tests pin
 * the properties that made the drift damaging.
 */

import { supportSessionFields, nativeCrispFields, setCrispUserData } from '../crisp'
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

    /*
     * `sendMessage` is `unimplemented` in this plugin on BOTH iOS and Android,
     * so the prefill never reached Crisp in the app — every "contact support
     * about X" entry point lost its context, silently. The topic rides as a data
     * row, which both platforms implement, and on web it also survives the user
     * clearing the prefilled composer before sending.
     */
    it('carries the support topic so native does not lose it', () => {
        const withTopic = Object.fromEntries(supportSessionFields(userData(), 'my withdrawal is stuck'))
        expect(withTopic.support_topic).toBe('my withdrawal is stuck')
        expect(Object.fromEntries(supportSessionFields(userData())).support_topic).toBe('')
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

describe('setCrispUserData segments', () => {
    const push = (): { calls: unknown[][] } & { push: (entry: unknown[]) => void } => {
        const calls: unknown[][] = []
        return { calls, push: (entry: unknown[]) => void calls.push(entry) }
    }
    const segmentPushes = (calls: unknown[][]) => calls.filter(([, key]) => key === 'session:segments')

    /*
     * Crisp APPENDS session segments unless the second argument is true, and
     * this runs again on every snapshot change. Without the flag a user who was
     * briefly offline keeps routing as `offline` after recovery, and
     * `kyc-pending` outlives their approval — the inbox then filters on state
     * the user has already left, which is worse than no segments at all.
     */
    it('replaces the segment set rather than appending to it', () => {
        const crisp = push()
        setCrispUserData(crisp as never, userData({ segments: ['web', 'kyc-pending', 'offline'] }))

        const [, , payload] = segmentPushes(crisp.calls)[0] as [string, string, unknown[]]
        expect(payload).toEqual([['web', 'kyc-pending', 'offline'], true])
    })

    it('leaves no trace of a segment the user has moved past', () => {
        const crisp = push()
        setCrispUserData(crisp as never, userData({ segments: ['web', 'kyc-pending', 'offline'] }))
        setCrispUserData(crisp as never, userData({ segments: ['web', 'kyc-verified'] }))

        const pushes = segmentPushes(crisp.calls)
        expect(pushes).toHaveLength(2)
        for (const [, , payload] of pushes as [string, string, unknown[]][]) {
            expect(payload[1]).toBe(true)
        }
        expect((pushes[1] as [string, string, unknown[]])[2][0]).toEqual(['web', 'kyc-verified'])
    })

    it('pushes nothing when there are no segments, rather than clearing blindly', () => {
        const crisp = push()
        setCrispUserData(crisp as never, userData({ segments: [] }))

        expect(segmentPushes(crisp.calls)).toHaveLength(0)
    })
})
