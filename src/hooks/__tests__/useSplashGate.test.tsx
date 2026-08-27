// PEANUT-UI-SVN: hiding the splash while the activity is backgrounded runs the
// Android splash teardown against a window that is released by the time the app
// resumes and draws, crashing the process. The hide must park until active.
import { renderHook, waitFor, act } from '@testing-library/react'
import { useSplashGate, resetSplashGateForTests } from '../useSplashGate'

jest.mock('next/navigation', () => ({ usePathname: () => '/home' }))

jest.mock('@/utils/capacitor', () => ({ isCapacitor: jest.fn(() => true) }))

jest.mock('@/i18n/app/locale-store', () => ({ localeApplied: jest.fn(() => Promise.resolve()) }))

const hide = jest.fn(() => Promise.resolve())
jest.mock('@capacitor/splash-screen', () => ({ SplashScreen: { hide: () => hide() } }))

let isActive = true
const removeListener = jest.fn(() => Promise.resolve())
let emitState: ((state: { isActive: boolean }) => void) | undefined
jest.mock('@capacitor/app', () => ({
    App: {
        getState: jest.fn(() => Promise.resolve({ isActive })),
        addListener: jest.fn((_event: string, cb: (state: { isActive: boolean }) => void) => {
            emitState = cb
            return Promise.resolve({ remove: removeListener })
        }),
    },
}))

let warn: jest.SpyInstance

beforeEach(() => {
    jest.clearAllMocks()
    resetSplashGateForTests()
    isActive = true
    emitState = undefined
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
    warn.mockRestore()
})

describe('useSplashGate', () => {
    it('hides the splash once the locale is painted', async () => {
        renderHook(() => useSplashGate())

        await waitFor(() => expect(hide).toHaveBeenCalledTimes(1))
        expect(warn).not.toHaveBeenCalled()
    })

    it('defers the hide while the app is backgrounded and fires it on resume', async () => {
        isActive = false

        renderHook(() => useSplashGate())

        await waitFor(() => expect(emitState).toBeDefined())
        expect(hide).not.toHaveBeenCalled()

        // a second background event must not release the parked hide
        await act(async () => {
            emitState!({ isActive: false })
        })
        expect(hide).not.toHaveBeenCalled()

        await act(async () => {
            emitState!({ isActive: true })
        })
        await waitFor(() => expect(hide).toHaveBeenCalledTimes(1))
        expect(removeListener).toHaveBeenCalledTimes(1)
        expect(warn).not.toHaveBeenCalled()
    })

    // The listener has to be live before the state is read: appStateChange is
    // never replayed, so a resume in that gap would park the splash forever
    // (splashHidden is already set, so the hard timeout cannot retry).
    it('does not miss a resume that lands while the state read is in flight', async () => {
        const { App } = jest.requireMock('@capacitor/app')
        let releaseState!: (state: { isActive: boolean }) => void
        App.getState.mockImplementationOnce(
            () => new Promise<{ isActive: boolean }>((resolve) => (releaseState = resolve))
        )

        renderHook(() => useSplashGate())

        await waitFor(() => expect(emitState).toBeDefined())
        await act(async () => {
            emitState!({ isActive: true })
            releaseState({ isActive: false })
        })

        await waitFor(() => expect(hide).toHaveBeenCalledTimes(1))
        expect(removeListener).toHaveBeenCalledTimes(1)
        expect(warn).not.toHaveBeenCalled()
    })

    it('gives up on the wait when the listener cannot be registered', async () => {
        isActive = false
        const { App } = jest.requireMock('@capacitor/app')
        App.addListener.mockRejectedValueOnce(new Error('not implemented'))

        renderHook(() => useSplashGate())

        await waitFor(() => expect(hide).toHaveBeenCalledTimes(1))
    })

    it('still hides when the app plugin is unavailable', async () => {
        const { App } = jest.requireMock('@capacitor/app')
        App.getState.mockRejectedValueOnce(new Error('not implemented'))

        renderHook(() => useSplashGate())

        await waitFor(() => expect(hide).toHaveBeenCalledTimes(1))
    })
})
