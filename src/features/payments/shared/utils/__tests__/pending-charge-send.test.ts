/**
 * Chip on ui#4198: when local storage refuses the marker, the guard must still
 * see it on this page (verification/tla/ChargeSendFlow.tla,
 * StorageFail).
 */
import { keccak256, stringToBytes } from 'viem'
import {
    forgetLegacyMantecaWithdrawMarkers,
    mantecaWithdrawIntent,
    pendingChargeSendKey,
    readPendingChargeSend,
    writePendingChargeSend,
} from '../pending-charge-send'

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

// TASK-25248: the key outlives sign-out, so it names no bank account, Pix key or hash of one.
it("a Manteca withdrawal's key names a saved account by its id, and an unsaved destination not at all", () => {
    expect(pendingChargeSendKey('u1', mantecaWithdrawIntent('acct-1'))).toBe(
        'peanut:pendingChargeSend:u1:withdraw-manteca:account:acct-1'
    )
    expect(pendingChargeSendKey('u1', mantecaWithdrawIntent(null))).toBe(
        'peanut:pendingChargeSend:u1:withdraw-manteca:new'
    )
})

it("drops this user's Manteca markers in an older key format and keeps the current ones", () => {
    const cbu = '0000003100010000000001'
    const raw = pendingChargeSendKey('u1', `withdraw-manteca:${cbu}`)
    const hashed = pendingChargeSendKey('u1', `withdraw-manteca:${keccak256(stringToBytes(`u1:${cbu}`))}`)
    const saved = pendingChargeSendKey('u1', mantecaWithdrawIntent('acct-1'))
    const unsaved = pendingChargeSendKey('u1', mantecaWithdrawIntent(null))
    const otherUser = pendingChargeSendKey('u2', `withdraw-manteca:${cbu}`)
    for (const key of [raw, hashed, saved, unsaved, otherUser, KEY]) writePendingChargeSend(key, SEND)

    forgetLegacyMantecaWithdrawMarkers('u1')

    expect(window.localStorage.getItem(raw)).toBeNull()
    expect(window.localStorage.getItem(hashed)).toBeNull()
    expect(readPendingChargeSend(saved)).toEqual(SEND)
    expect(readPendingChargeSend(unsaved)).toEqual(SEND)
    expect(window.localStorage.getItem(otherUser)).not.toBeNull()
    expect(readPendingChargeSend(KEY)).toEqual(SEND)
})
