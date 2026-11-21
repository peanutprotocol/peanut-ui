/**
 * Chip on ui#4198 (usePendingChargeSend.ts:112): the claim latch lived in one
 * tab's memory and the marker was written only after the charge was created,
 * so a second tab could tap Pay in that window and send twice (mono
 * ChargeSendFlow.tla, _BuggyCrossTab). Two hook instances share no claim, as
 * two tabs share none.
 */
import { act } from '@testing-library/react'
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

/*
 * Audit of wave 1: another tab's lease was read only when a screen opened, so
 * an open screen kept Pay off past the 15 minutes; and a tab whose claim was
 * dropped after its lease still sent, with no marker (mono ChargeSendFlow.tla,
 * _BuggyLeaseSteal).
 */
it("another tab's unsent claim ends with its lease while this screen stays open", async () => {
    jest.useFakeTimers()
    try {
        claimOf({ chargeId: '', owner: 'other-tab', startedAt: Date.now(), userOps: [], backendBroadcast: false })
        const tab = screen()
        expect(tab.result.current.isPending).toBe(true)
        await act(async () => {
            await jest.advanceTimersByTimeAsync(15 * 60_000 + 1_000)
        })
        expect(tab.result.current.isPending).toBe(false)
        expect(window.localStorage.getItem(KEY)).toBeNull()
    } finally {
        jest.useRealTimers()
    }
})

it('a tab whose marker another tab dropped after the lease sends nothing', () => {
    const tab = screen()
    expect(tab.result.current.claim()).toBe(true)
    tab.result.current.begin('charge-1')
    // the other tab drops the marker as abandoned, then claims its own
    claimOf({ chargeId: '', owner: 'other-tab', startedAt: Date.now(), userOps: [], backendBroadcast: false })
    expect(() => tab.result.current.onBroadcast({ via: 'backend' })).toThrow()
    expect(JSON.parse(window.localStorage.getItem(KEY) ?? 'null')?.backendBroadcast).toBe(false)
    // its failure path leaves the other tab's claim alone
    tab.result.current.clear()
    expect(window.localStorage.getItem(KEY)).not.toBeNull()

    window.localStorage.removeItem(KEY)
    expect(() => tab.result.current.onBroadcast({ via: 'backend' })).toThrow()
})

it("this attempt's own marker lets its broadcast through", () => {
    const tab = screen()
    expect(tab.result.current.claim()).toBe(true)
    tab.result.current.begin('charge-1')
    tab.result.current.onBroadcast({ via: 'backend' })
    expect(JSON.parse(window.localStorage.getItem(KEY) ?? 'null')?.backendBroadcast).toBe(true)
    tab.result.current.clear()
})
