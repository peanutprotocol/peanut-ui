import { disableDemoMode, enableDemoMode, isDemoMode, isDemoUsername } from '@/utils/demo'
import { isCapacitor } from '@/utils/capacitor'

jest.mock('@/utils/capacitor', () => ({ isCapacitor: jest.fn(() => false) }))

const mockIsCapacitor = isCapacitor as jest.Mock

const DEMO_MODE_KEY = 'peanut_demo_mode'

describe('explicit demo sessions on web and native', () => {
    afterEach(() => {
        disableDemoMode()
        window.localStorage.removeItem(DEMO_MODE_KEY)
        mockIsCapacitor.mockReturnValue(false)
    })

    it('is off by default on web', () => {
        disableDemoMode()
        expect(isDemoMode()).toBe(false)
    })

    it('activates on web when explicitly enabled', () => {
        mockIsCapacitor.mockReturnValue(false)
        enableDemoMode()
        expect(isDemoMode()).toBe(true)
    })

    it('restores a web demo session from localStorage', () => {
        mockIsCapacitor.mockReturnValue(false)
        window.localStorage.setItem(DEMO_MODE_KEY, 'true')
        expect(isDemoMode()).toBe(true)
    })

    it.each(['demo', 'DEMO', ' Demo '])('recognizes %s without enabling the session', (code) => {
        expect(isDemoUsername(code)).toBe(true)
        expect(isDemoMode()).toBe(false)
    })

    it.each(['demouser', 'dem', '@demo', '', null, undefined])('rejects ordinary or missing codes: %s', (code) => {
        expect(isDemoUsername(code)).toBe(false)
    })

    it('is true in the native shell once enabled', () => {
        mockIsCapacitor.mockReturnValue(true)
        enableDemoMode()
        expect(isDemoMode()).toBe(true)
    })

    it('survives a cold relaunch in the native shell via localStorage', () => {
        mockIsCapacitor.mockReturnValue(true)
        // fresh session: only the persisted flag is present
        window.localStorage.setItem(DEMO_MODE_KEY, 'true')
        expect(isDemoMode()).toBe(true)
    })

    it('is fully cleared by disableDemoMode()', () => {
        mockIsCapacitor.mockReturnValue(true)
        enableDemoMode()
        disableDemoMode()
        expect(isDemoMode()).toBe(false)
        expect(window.localStorage.getItem(DEMO_MODE_KEY)).toBeNull()
    })
})
