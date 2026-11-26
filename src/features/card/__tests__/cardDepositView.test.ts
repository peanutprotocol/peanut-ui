import { cardDepositView } from '../cardDepositView'

// the only state in which the address may show: the API's own "not started", taken in against a fresh
// balance read, nothing held, nothing being cleared
const SAFE = {
    addressLoading: false,
    addressError: false,
    statusRead: true,
    statusError: false,
    statusFailing: false,
    status: 'not_started' as const,
    checked: true,
    balanceFresh: true,
    balanceReadFailed: false,
    clearing: false,
    clearFailed: false,
    holding: false,
    done: false,
}

describe('cardDepositView: the address only when no deposit can be on its way and the balance is fresh', () => {
    it('shows the address for the API\'s own "not started", checked against a fresh balance read', () => {
        expect(cardDepositView(SAFE)).toBe('address')
    })

    it.each([
        ['the status is not read yet (or only a clear wrote "not started")', { statusRead: false }, 'loading'],
        ['the status read failed', { statusRead: false, statusError: true }, 'check-failed'],
        ['the latest poll failed after an earlier answer', { statusFailing: true }, 'check-failed'],
        ['the first answer is not taken in yet', { checked: false }, 'loading'],
        ['no fresh balance read came back since the last clear', { balanceFresh: false }, 'loading'],
        ['the fresh balance read failed', { balanceReadFailed: true }, 'check-failed'],
        ['an earlier outcome is being cleared', { clearing: true }, 'loading'],
        ['an earlier outcome could not be cleared', { clearFailed: true }, 'check-failed'],
        ['a deposit is on its way', { status: 'loading' as const }, 'processing'],
        ['a deposit seen or reported is not yet in a fresh read', { holding: true }, 'processing'],
        ['a completed outcome is not resolved or cleared yet', { status: 'completed' as const }, 'loading'],
        ['the provider returned the deposit', { status: 'failed' as const }, 'failed'],
        ['the address is loading', { addressLoading: true }, 'loading'],
        ['no address could be opened', { addressError: true }, 'address-error'],
    ])('never shows the address when %s', (_label, change, view) => {
        expect(cardDepositView({ ...SAFE, ...change })).toBe(view)
    })

    it('holds processing over a failed read: the hold reads again on its own', () => {
        expect(cardDepositView({ ...SAFE, holding: true, balanceReadFailed: true })).toBe('processing')
    })

    it('stays done when a later poll or read fails: the gap is covered either way', () => {
        expect(cardDepositView({ ...SAFE, done: true, statusFailing: true })).toBe('done')
        expect(cardDepositView({ ...SAFE, done: true, balanceReadFailed: true })).toBe('done')
    })

    it('says done once the gap is covered, over the completed outcome the poll stops on', () => {
        expect(cardDepositView({ ...SAFE, status: 'completed', done: true })).toBe('done')
    })
})
