import { renderHook } from '@testing-library/react'
import type { FeatureReport, FeatureReportEntry } from '@/types/capabilities'
import { bankReadyReminder, markBankReadyShown, readyAccountIds, shownBankReady } from '../bankReadyReminder'
import { resetBankReadyReminderForTests, useBankReadyReminder } from '../useBankReadyReminder'

const mockReplace = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace: mockReplace }) }))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: { user: { userId: 'u1' } } }) }))
let mockReport: FeatureReport | undefined
jest.mock('@/hooks/useCapabilities', () => ({ useCapabilities: () => ({ capabilities: { features: mockReport } }) }))
let mockBusy = false
jest.mock('@/features/attention/AttentionProvider', () => ({
    useAttentionOptional: () => ({ session: { busy: mockBusy } }),
}))
let mockInAppHistory = false
jest.mock('@/hooks/useSafeBack', () => ({ hasInAppHistory: () => mockInAppHistory }))
jest.mock('posthog-js', () => ({ capture: jest.fn() }))

const on: FeatureReportEntry = { state: 'on' }
const opening: FeatureReportEntry = { state: 'setting_up' }
const report = (bank: Record<string, FeatureReportEntry>, local: Record<string, FeatureReportEntry> = {}) =>
    ({
        qr: opening,
        card: opening,
        bank: { state: 'setting_up', accounts: bank },
        local: { state: 'setting_up', accounts: local },
    }) as FeatureReport

describe('readyAccountIds', () => {
    it('lists the bank and local accounts that take money now', () => {
        expect(readyAccountIds(report({ USD: on, EUR: opening }, { ARS: on }))).toEqual(['bank.USD', 'local.ARS'])
        expect(readyAccountIds(undefined)).toEqual([])
    })
})

describe('bankReadyReminder', () => {
    const base = { shown: [] as string[], addedMoney: false, inTask: false }
    it('shows a newly ready account', () => {
        expect(bankReadyReminder({ ...base, ready: ['bank.USD'] })).toEqual(['bank.USD'])
    })
    it('never shows an account already shown', () => {
        expect(bankReadyReminder({ ...base, ready: ['bank.USD'], shown: ['bank.USD'] })).toEqual([])
    })
    it('shows a second account that opens later', () => {
        expect(bankReadyReminder({ ...base, ready: ['bank.USD', 'local.ARS'], shown: ['bank.USD'] })).toEqual([
            'local.ARS',
        ])
    })
    it('never shows to a person who added money', () => {
        expect(bankReadyReminder({ ...base, ready: ['bank.USD'], addedMoney: true })).toEqual([])
    })
    it('never shows in a task', () => {
        expect(bankReadyReminder({ ...base, ready: ['bank.USD'], inTask: true })).toEqual([])
    })
    it('never shows on the first load, when nothing is recorded yet', () => {
        expect(bankReadyReminder({ ...base, ready: ['bank.USD'], shown: undefined })).toEqual([])
    })
})

describe('useBankReadyReminder', () => {
    // each call is a new app load: the one chance is per load
    const load = () => {
        resetBankReadyReminderForTests()
        return useBankReadyReminder
    }
    beforeEach(() => {
        localStorage.clear()
        mockReplace.mockClear()
        mockBusy = false
        mockInAppHistory = false
        mockReport = report({ USD: on })
        // a person who already has a record on this device (a later load, or the verified page seen)
        markBankReadyShown('u1', [])
    })

    it('first load since release: accounts ready already are recorded, not shown; a later one shows once', () => {
        localStorage.clear()
        renderHook(() => load()(false))
        expect(mockReplace).not.toHaveBeenCalled()
        expect(shownBankReady('u1')).toEqual(['bank.USD'])

        mockReport = report({ USD: on }, { ARS: on })
        renderHook(() => load()(false))
        expect(mockReplace).toHaveBeenCalledTimes(1)
        expect(shownBankReady('u1')).toEqual(['bank.USD', 'local.ARS'])
    })

    it('first load with nothing ready records an empty list, so the first account to open shows', () => {
        localStorage.clear()
        mockReport = report({ USD: opening })
        renderHook(() => load()(false))
        expect(shownBankReady('u1')).toEqual([])

        mockReport = report({ USD: on })
        renderHook(() => load()(false))
        expect(mockReplace).toHaveBeenCalledWith('/verified?variant=bank-ready')
    })

    it('opens the page once for the first ready account, then never again for it', () => {
        renderHook(() => load()(false))
        expect(mockReplace).toHaveBeenCalledWith('/verified?variant=bank-ready')
        expect(shownBankReady('u1')).toEqual(['bank.USD'])

        mockReplace.mockClear()
        renderHook(() => load()(false))
        expect(mockReplace).not.toHaveBeenCalled()
    })

    it('opens it again on the next app open when a second account becomes ready', () => {
        markBankReadyShown('u1', ['bank.USD'])
        mockReport = report({ USD: on }, { ARS: on })
        renderHook(() => load()(false))
        expect(mockReplace).toHaveBeenCalledTimes(1)
        expect(shownBankReady('u1')).toEqual(['bank.USD', 'local.ARS'])
    })

    it('waits for the balance and never opens for a person who added money', () => {
        renderHook(() => load()(undefined))
        renderHook(() => load()(true))
        expect(mockReplace).not.toHaveBeenCalled()
        expect(shownBankReady('u1')).toEqual([])
    })

    it('a cached $0 that turns into a live balance never opens it', () => {
        const hook = load()
        const view = renderHook(({ added }: { added: boolean | undefined }) => hook(added), {
            initialProps: { added: undefined as boolean | undefined },
        })
        view.rerender({ added: true })
        expect(mockReplace).not.toHaveBeenCalled()
        expect(shownBankReady('u1')).toEqual([])
    })

    it('never opens when home was reached from another screen (a task), nor over an open drawer', () => {
        mockInAppHistory = true
        renderHook(() => load()(false))
        mockInAppHistory = false
        mockBusy = true
        renderHook(() => load()(false))
        expect(mockReplace).not.toHaveBeenCalled()
    })

    it('has one chance per app load: back on home after leaving it, it stays shut', () => {
        mockReport = report({ USD: opening })
        const hook = load()
        const first = renderHook(() => hook(false))
        first.unmount()
        mockReport = report({ USD: on })
        renderHook(() => hook(false))
        expect(mockReplace).not.toHaveBeenCalled()
    })
})
