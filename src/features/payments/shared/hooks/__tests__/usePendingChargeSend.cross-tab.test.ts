/**
 * Chip on ui#4198 (usePendingChargeSend.ts:112): the claim latch lived in one
 * tab's memory and the marker was written only after the charge was created,
 * so a second tab could tap Pay in that window and send twice (mono
 * ChargeSendFlow.tla, _BuggyCrossTab). Two hook instances share no claim, as
 * two tabs share none.
 */
import { renderHookWithIntl } from '@/test-utils/intl'

jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: { user: { userId: 'u1' } } }) }))
jest.mock('@/utils/userop-outcome', () => ({ readUserOpOutcome: jest.fn().mockResolvedValue('unknown') }))

import { usePendingChargeSend } from '../usePendingChargeSend'
import { thisTab } from '../../utils/pending-charge-send'

const INTENT = 'direct-send:0x1111111111111111111111111111111111111111'
const KEY = `peanut:pendingChargeSend:u1:${INTENT}`

function screen() {
    return renderHookWithIntl(() =>
        usePendingChargeSend({
            intent: INTENT,
            walletAddress: '0x2222222222222222222222222222222222222222',
            fetchCharge: jest.fn().mockResolvedValue({ status: 'PENDING' }),
            recordPayment: jest.fn(),
            canResume: true,
            setCharge: jest.fn(),
            setIsSuccess: jest.fn(),
            setCurrentView: jest.fn(),
            setError: jest.fn(),
        })
    )
}
const claimOf = (send: object) => window.localStorage.setItem(KEY, JSON.stringify(send))

beforeEach(() => window.localStorage.clear())

it('a tap claimed in one tab keeps Pay off in another before the charge exists', () => {
    const tabA = screen()
    const tabB = screen()
    expect(tabA.result.current.claim()).toBe(true)
    // tab A is still creating the charge: nothing was sent yet
    expect(tabB.result.current.claim()).toBe(false)
    tabA.rerender()
    tabB.rerender()
    expect(tabB.result.current.isPending).toBe(true)

    // tab A's attempt ends before `begin`: its claim goes, and Pay comes back
    tabA.result.current.release()
    expect(window.localStorage.getItem(KEY)).toBeNull()
    expect(tabB.result.current.claim()).toBe(true)
    tabB.result.current.release()
})

it("another tab's live claim survives this tab opening the screen", () => {
    claimOf({ chargeId: '', owner: 'other-tab', startedAt: Date.now(), userOps: [], backendBroadcast: false })
    const tab = screen()
    expect(window.localStorage.getItem(KEY)).not.toBeNull()
    expect(tab.result.current.claim()).toBe(false)
})

it("another tab's claim past its lease, and this tab's own from before a reload, are dropped", () => {
    claimOf({
        chargeId: '',
        owner: 'other-tab',
        startedAt: Date.now() - 16 * 60_000,
        userOps: [],
        backendBroadcast: false,
    })
    screen()
    expect(window.localStorage.getItem(KEY)).toBeNull()

    claimOf({ chargeId: 'charge-1', owner: thisTab(), startedAt: Date.now(), userOps: [], backendBroadcast: false })
    screen()
    expect(window.localStorage.getItem(KEY)).toBeNull()
})
