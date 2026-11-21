/**
 * Chip on ui#4198: when local storage refuses the marker, the guard must still
 * see it, and the caller must learn it was not saved (mono
 * engineering/api/state-machines/ChargeSendFlow.tla, StorageFail).
 */
import { readPendingChargeSend, writePendingChargeSend } from '../pending-charge-send'

const KEY = 'peanut:pendingChargeSend:u1:direct-send:0x1111111111111111111111111111111111111111'
const SEND = { chargeId: 'charge-1', startedAt: 1, userOps: [], backendBroadcast: false }

afterEach(() => {
    jest.restoreAllMocks()
    writePendingChargeSend(KEY, null)
    window.localStorage.clear()
})

it('a write storage refuses reports false, and the marker is still read on this page', () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('quota exceeded', 'QuotaExceededError')
    })
    expect(writePendingChargeSend(KEY, SEND)).toBe(false)
    expect(readPendingChargeSend(KEY)).toEqual(SEND)
})

it('a refused update is read over the older marker storage still holds', () => {
    expect(writePendingChargeSend(KEY, SEND)).toBe(true)
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('quota exceeded', 'QuotaExceededError')
    })
    const sent = { ...SEND, txHash: `0x${'cd'.repeat(32)}` as const }
    expect(writePendingChargeSend(KEY, sent)).toBe(false)
    expect(readPendingChargeSend(KEY)).toEqual(sent)
})

it('a saved write reports true and clearing removes both copies', () => {
    expect(writePendingChargeSend(KEY, SEND)).toBe(true)
    expect(window.localStorage.getItem(KEY)).not.toBeNull()
    writePendingChargeSend(KEY, null)
    expect(readPendingChargeSend(KEY)).toBeNull()
})
