import { disableDemoMode, enableDemoMode, isDemoMode } from '@/utils/demo'
import { isCapacitor } from '@/utils/capacitor'

jest.mock('@/utils/capacitor', () => ({ isCapacitor: jest.fn(() => false) }))

const mockIsCapacitor = isCapacitor as jest.Mock

const DEMO_MODE_KEY = 'peanut_demo_mode'

// Demo mode short-circuits auth and every API call, so it must be impossible
// to activate outside the native (Capacitor) shell — even with the flags set.
describe('isDemoMode — web-inert guarantee', () => {
    afterEach(() => {
        disableDemoMode()
        window.localStorage.removeItem(DEMO_MODE_KEY)
        mockIsCapacitor.mockReturnValue(false)
    })

    it('is false on web even after enableDemoMode() sets the session flag', () => {
        mockIsCapacitor.mockReturnValue(false)
        enableDemoMode()
        expect(isDemoMode()).toBe(false)
    })

    it('is false on web even when the localStorage flag is set directly', () => {
        mockIsCapacitor.mockReturnValue(false)
        window.localStorage.setItem(DEMO_MODE_KEY, 'true')
        expect(isDemoMode()).toBe(false)
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
