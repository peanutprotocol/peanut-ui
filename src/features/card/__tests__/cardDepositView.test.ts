import { cardDepositView } from '../cardDepositView'

// the state in which the address is safe to show: a real "not started", checked, nothing pending
const SAFE = {
    addressLoading: false,
    addressError: false,
    statusRead: true,
    statusError: false,
    status: 'not_started' as const,
    checked: true,
    clearing: false,
    clearFailed: false,
    pending: false,
    done: false,
}

describe('cardDepositView: the address only when no deposit can be on its way', () => {
    it('shows the address for a real "not started" answer, checked, with nothing pending', () => {
        expect(cardDepositView(SAFE)).toBe('address')
    })

    it.each([
        ['the status is not read yet', { statusRead: false }, 'loading'],
        ['the status read failed', { statusRead: false, statusError: true }, 'check-failed'],
        ['the first answer is not taken in yet', { checked: false }, 'loading'],
        ['an old outcome is being cleared', { clearing: true }, 'loading'],
        ['an old outcome or its balance read could not be cleared', { clearFailed: true }, 'check-failed'],
        ['a deposit is on its way', { status: 'loading' as const }, 'processing'],
        ['a reported deposit waits for the balance', { pending: true }, 'processing'],
        ['a completed outcome is not resolved yet', { status: 'completed' as const }, 'loading'],
        ['the provider returned the deposit', { status: 'failed' as const }, 'failed'],
        ['the address is loading', { addressLoading: true }, 'loading'],
        ['no address could be opened', { addressError: true }, 'address-error'],
    ])('never shows the address when %s', (_label, change, view) => {
        expect(cardDepositView({ ...SAFE, ...change })).toBe(view)
    })

    it('says done once the gap is covered, over the completed outcome the poll stops on', () => {
        expect(cardDepositView({ ...SAFE, status: 'completed', done: true })).toBe('done')
    })

    it('keeps a failed clear in front of an unread status, so the retry clears again', () => {
        expect(cardDepositView({ ...SAFE, clearFailed: true, statusRead: false })).toBe('check-failed')
    })
})
