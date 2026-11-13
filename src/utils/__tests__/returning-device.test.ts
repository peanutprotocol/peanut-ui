import { hasKnownDeviceCredentials } from '@/components/Setup/setup-entry'
import { isReturningDevice, markDeviceHadAccount } from '@/utils/returning-device'

jest.mock('@/components/Setup/setup-entry', () => ({ hasKnownDeviceCredentials: jest.fn() }))
const credentials = hasKnownDeviceCredentials as jest.MockedFunction<typeof hasKnownDeviceCredentials>
const key = 'peanut-device-had-account'

describe('returning device marker', () => {
    beforeEach(() => {
        localStorage.clear()
        credentials.mockReset()
        credentials.mockReturnValue(false)
    })
    afterEach(() => jest.restoreAllMocks())

    it.each<[string | null, boolean, boolean]>([
        [null, false, false],
        ['1', false, true],
        ['0', false, false],
        ['true', false, false],
        ['', false, false],
        [null, true, true],
        ['0', true, true],
    ])('evaluates marker %p and credentials %p', (marker, known, expected) => {
        if (marker !== null) localStorage.setItem(key, marker)
        credentials.mockReturnValue(known)
        expect(isReturningDevice()).toBe(expected)
    })

    it('writes the bare marker idempotently', () => {
        markDeviceHadAccount()
        markDeviceHadAccount()
        expect(localStorage.length).toBe(1)
        expect(localStorage.getItem(key)).toBe('1')
        expect(isReturningDevice()).toBe(true)
    })

    it('does not throw when setItem fails', () => {
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('unavailable')
        })
        expect(markDeviceHadAccount).not.toThrow()
    })

    it('returns false when getItem fails even if credentials match', () => {
        credentials.mockReturnValue(true)
        jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('unavailable')
        })
        expect(isReturningDevice()).toBe(false)
    })

    it('returns false when credential access fails', () => {
        credentials.mockImplementation(() => {
            throw new Error('unavailable')
        })
        expect(isReturningDevice()).toBe(false)
    })

    it('handles a throwing localStorage getter', () => {
        jest.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
            throw new Error('unavailable')
        })
        expect(markDeviceHadAccount).not.toThrow()
        expect(isReturningDevice()).toBe(false)
    })

    it('tracks a deterministic sequence of removals, writes, and credential changes', () => {
        const operations = ['check', 'mark', 'check', 'remove', 'check', 'credentials', 'check', 'mark', 'check']
        const observed: boolean[] = []
        for (const operation of operations) {
            if (operation === 'mark') markDeviceHadAccount()
            if (operation === 'remove') localStorage.removeItem(key)
            if (operation === 'credentials') credentials.mockReturnValue(true)
            if (operation === 'check') observed.push(isReturningDevice())
        }
        expect(observed).toEqual([false, true, false, true, true])
    })
})
