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
     * Segments are a field people write by hand, and one of them backs an OKR:
     * agents tag translation reports `translation-issue` and the monthly count
     * only sees a conversation that still carries it. Crisp has no partial
     * write — a set replaces the whole list — so any automatic write erases
     * whatever a human put there, and this function runs on every snapshot
     * change, not only when support opens. Appending instead would leave the
     * app's own flags stale. So the app writes none. See TASK-21968.
     */
    it('never writes Crisp segments, whatever the snapshot says', () => {
        const crisp = push()
        setCrispUserData(crisp as never, userData({ segments: ['web', 'kyc-pending', 'offline'] }))
        setCrispUserData(crisp as never, userData({ segments: ['web', 'kyc-verified'] }))

        expect(segmentPushes(crisp.calls)).toHaveLength(0)
    })

    /*
     * A routine metadata refresh omits the composer prefill on purpose — pushing
     * it again would overwrite what the user is typing. The topic must survive
     * that anyway, or a balance update erases the reason they opened support.
     */
    it('keeps the support topic through a refresh that must not touch the composer', () => {
        const crisp = push()
        setCrispUserData(crisp as never, userData(), undefined, 'my withdrawal is stuck')

        const dataPush = crisp.calls.find(([, key]) => key === 'session:data') as [string, string, unknown[][]]
        expect(Object.fromEntries(dataPush[2][0] as [string, string][]).support_topic).toBe('my withdrawal is stuck')
        expect(crisp.calls.filter(([, key]) => key === 'message:text')).toHaveLength(0)
    })

    /*
     * The iframe stays mounted between open cycles, so the composer keeps
     * whatever was last put in it. Open support from an error CTA, close
     * without sending, reopen from the nav: the new cycle has no prefill, and a
     * falsy guard skipped the clear — leaving the old error text in the box.
     * `undefined` means "leave the composer alone" (routine metadata refresh);
     * an empty string is a real instruction to clear it.
     */
    it('clears the composer when a new cycle has no prefill', () => {
        const crisp = push()
        setCrispUserData(crisp as never, userData(), '')

        expect(crisp.calls.filter(([, key]) => key === 'message:text')).toEqual([['set', 'message:text', ['']]])
    })

    it('leaves the composer alone on a routine metadata refresh', () => {
        const crisp = push()
        setCrispUserData(crisp as never, userData(), undefined, 'topic only')

        expect(crisp.calls.filter(([, key]) => key === 'message:text')).toHaveLength(0)
    })

    it('still gives the agent the flags, as a data row', () => {
        const crisp = push()
        setCrispUserData(crisp as never, userData({ segments: ['web', 'kyc-verified'] }))

        const [, , payload] = crisp.calls.find(([, key]) => key === 'session:data') as [string, string, unknown[][]]
        expect(Object.fromEntries(payload[0] as [string, string][]).segments).toBe('web kyc-verified')
    })
})
