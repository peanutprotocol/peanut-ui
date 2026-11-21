/**
 * Chip on ui#4198: when local storage refuses the marker, the guard must still
 * see it on this page (mono engineering/api/state-machines/ChargeSendFlow.tla,
 * StorageFail).
 */
import { readPendingChargeSend, writePendingChargeSend } from '../pending-charge-send'

const KEY = 'peanut:pendingChargeSend:u1:direct-send:0x1111111111111111111111111111111111111111'
const SEND = { chargeId: 'charge-1', startedAt: 1, userOps: [], backendBroadcast: false }

afterEach(() => {
    jest.restoreAllMocks()
    writePendingChargeSend(KEY, null)
    window.localStorage.clear()
})

it('a write storage refuses is still read on this page', () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('quota exceeded', 'QuotaExceededError')
    })
    writePendingChargeSend(KEY, SEND)
    expect(window.localStorage.getItem(KEY)).toBeNull()
    expect(readPendingChargeSend(KEY)).toEqual(SEND)
})

it('a refused update is read over the older marker storage still holds', () => {
    writePendingChargeSend(KEY, SEND)
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('quota exceeded', 'QuotaExceededError')
    })
    const sent = { ...SEND, txHash: `0x${'cd'.repeat(32)}` as const }
    writePendingChargeSend(KEY, sent)
    expect(readPendingChargeSend(KEY)).toEqual(sent)
})

it('a saved write lands in storage and clearing removes both copies', () => {
    writePendingChargeSend(KEY, SEND)
    expect(window.localStorage.getItem(KEY)).not.toBeNull()
    writePendingChargeSend(KEY, null)
    expect(readPendingChargeSend(KEY)).toBeNull()
})
