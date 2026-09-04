import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'

import { loadingStateContext } from '@/context/loadingStates.context'
import { useStaleDeploymentReload } from '@/hooks/useStaleDeploymentReload'

const BUILD_COMMIT = 'aaaaaaa'
const NEW_COMMIT = 'bbbbbbb'

let mockPathname = '/home'
let mockPendingCount = 0
let mockIsSendingUserOp = false

const mockPurgeCaches = jest.fn().mockResolvedValue(undefined)
const mockIsStandalonePwa = jest.fn().mockReturnValue(false)
const mockIsCapacitor = jest.fn().mockReturnValue(false)

jest.mock('next/navigation', () => ({
    usePathname: () => mockPathname,
}))
jest.mock('@/hooks/wallet/usePendingTransactions', () => ({
    usePendingTransactions: () => ({
        hasPendingTransactions: mockPendingCount > 0,
        pendingCount: mockPendingCount,
    }),
}))
jest.mock('@/hooks/useZeroDevFlow', () => ({
    useZeroDevFlow: () => ({ isSendingUserOp: mockIsSendingUserOp }),
}))
jest.mock('@/utils/capacitor', () => ({
    isCapacitor: () => mockIsCapacitor(),
}))
jest.mock('@/utils/cache.utils', () => ({
    purgeCaches: (...args: unknown[]) => mockPurgeCaches(...args),
    isStandalonePwa: () => mockIsStandalonePwa(),
}))

let appStateHandler: ((state: { isActive: boolean }) => void) | null = null
const mockRemoveListener = jest.fn()

jest.mock(
    '@capacitor/app',
    () => ({
        App: {
            addListener: (_event: string, handler: (state: { isActive: boolean }) => void) => {
                appStateHandler = handler
                return Promise.resolve({ remove: mockRemoveListener })
            },
        },
    }),
    { virtual: true }
)

const TWELVE_HOURS_MS = 12 * 60 * 60_000

function setDocumentAge(ms: number) {
    jest.spyOn(performance, 'now').mockReturnValue(ms)
}

/** Foreground the app the way Capacitor's appStateChange would. */
async function resumeApp() {
    await waitFor(() => expect(appStateHandler).not.toBeNull())
    appStateHandler!({ isActive: true })
}

const mockReload = jest.fn()
const mockReplace = jest.fn()

function serveCommit(commit: string, ok = true) {
    global.fetch = jest.fn().mockResolvedValue({
        ok,
        json: async () => ({ commit }),
    }) as unknown as typeof fetch
}

function renderWithLoading(isLoading = false) {
    const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            loadingStateContext.Provider,
            {
                value: {
                    loadingState: isLoading ? 'Executing transaction' : 'Idle',
                    setLoadingState: () => {},
                    isLoading,
                },
            },
            children
        )
    return renderHook(() => useStaleDeploymentReload(), { wrapper })
}

beforeAll(() => {
    Object.defineProperty(window, 'location', {
        writable: true,
        value: { href: 'https://peanut.me/home', reload: mockReload, replace: mockReplace },
    })
})

beforeEach(() => {
    jest.clearAllMocks()
    jest.restoreAllMocks()
    sessionStorage.clear()
    process.env.NEXT_PUBLIC_GIT_COMMIT_HASH = BUILD_COMMIT
    mockPathname = '/home'
    mockPendingCount = 0
    mockIsSendingUserOp = false
    mockIsStandalonePwa.mockReturnValue(false)
    mockIsCapacitor.mockReturnValue(false)
    mockPurgeCaches.mockResolvedValue(undefined)
    appStateHandler = null
})

describe('useStaleDeploymentReload', () => {
    it('does not reload when the deployed commit matches the bundle', async () => {
        serveCommit(BUILD_COMMIT)
        renderWithLoading()

        await waitFor(() => expect(global.fetch).toHaveBeenCalled())
        expect(mockReload).not.toHaveBeenCalled()
    })

    it('reloads when the deployed commit differs', async () => {
        serveCommit(NEW_COMMIT)
        renderWithLoading()

        await waitFor(() => expect(mockReload).toHaveBeenCalledTimes(1))
    })

    it('purges the document caches before reloading', async () => {
        serveCommit(NEW_COMMIT)
        renderWithLoading()

        await waitFor(() => expect(mockReload).toHaveBeenCalled())
        expect(mockPurgeCaches).toHaveBeenCalledWith(
            expect.arrayContaining(['pages', 'pages-rsc', 'pages-rsc-prefetch', 'others'])
        )
    })

    it('uses location.replace in a standalone PWA', async () => {
        mockIsStandalonePwa.mockReturnValue(true)
        serveCommit(NEW_COMMIT)
        renderWithLoading()

        await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('https://peanut.me/home'))
        expect(mockReload).not.toHaveBeenCalled()
    })

    it('re-checks on visibility change', async () => {
        serveCommit(BUILD_COMMIT)
        renderWithLoading()
        await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))

        // the mount check just ran, so the throttle has to be stepped past
        jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 10 * 60_000)
        serveCommit(NEW_COMMIT)
        document.dispatchEvent(new Event('visibilitychange'))

        await waitFor(() => expect(mockReload).toHaveBeenCalledTimes(1))
        jest.spyOn(Date, 'now').mockRestore()
    })

    it('polls a tab that is never backgrounded or navigated', async () => {
        jest.useFakeTimers()
        try {
            serveCommit(BUILD_COMMIT)
            renderWithLoading()
            await jest.advanceTimersByTimeAsync(0)
            expect(global.fetch).toHaveBeenCalledTimes(1)

            serveCommit(NEW_COMMIT)
            await jest.advanceTimersByTimeAsync(30 * 60_000)

            expect(mockReload).toHaveBeenCalledTimes(1)
        } finally {
            jest.useRealTimers()
        }
    })

    it('is inert on native builds', async () => {
        mockIsCapacitor.mockReturnValue(true)
        serveCommit(NEW_COMMIT)
        renderWithLoading()

        await new Promise((resolve) => setTimeout(resolve, 0))
        expect(global.fetch).not.toHaveBeenCalled()
        expect(mockReload).not.toHaveBeenCalled()
    })

    describe('safety gate', () => {
        it('holds off while a balance-decreasing mutation is pending', async () => {
            mockPendingCount = 1
            serveCommit(NEW_COMMIT)
            renderWithLoading()

            await waitFor(() => expect(global.fetch).toHaveBeenCalled())
            expect(mockReload).not.toHaveBeenCalled()
        })

        it('holds off while a user op is in flight', async () => {
            mockIsSendingUserOp = true
            serveCommit(NEW_COMMIT)
            renderWithLoading()

            await waitFor(() => expect(global.fetch).toHaveBeenCalled())
            expect(mockReload).not.toHaveBeenCalled()
        })

        it('holds off while the app reports a loading state', async () => {
            serveCommit(NEW_COMMIT)
            renderWithLoading(true)

            await waitFor(() => expect(global.fetch).toHaveBeenCalled())
            expect(mockReload).not.toHaveBeenCalled()
        })

        it.each(['/card', '/withdraw/crypto', '/setup', '/add-money/crypto', '/en/card'])(
            'holds off on %s',
            async (pathname) => {
                mockPathname = pathname
                serveCommit(NEW_COMMIT)
                renderWithLoading()

                await waitFor(() => expect(global.fetch).toHaveBeenCalled())
                expect(mockReload).not.toHaveBeenCalled()
            }
        )

        it('reloads once a pending transaction settles', async () => {
            mockPendingCount = 1
            serveCommit(NEW_COMMIT)
            const { rerender } = renderWithLoading()

            await waitFor(() => expect(global.fetch).toHaveBeenCalled())
            expect(mockReload).not.toHaveBeenCalled()

            mockPendingCount = 0
            rerender()

            await waitFor(() => expect(mockReload).toHaveBeenCalledTimes(1))
        })

        it('reloads once the user navigates off an unsafe route', async () => {
            mockPathname = '/card'
            serveCommit(NEW_COMMIT)
            const { rerender } = renderWithLoading()

            await waitFor(() => expect(global.fetch).toHaveBeenCalled())
            expect(mockReload).not.toHaveBeenCalled()

            mockPathname = '/home'
            rerender()

            await waitFor(() => expect(mockReload).toHaveBeenCalledTimes(1))
        })
    })

    describe('loop guard', () => {
        it('stands down if a reload was already attempted and the mismatch persists', async () => {
            sessionStorage.setItem('peanut-stale-deploy-attempted', '1')
            serveCommit(NEW_COMMIT)
            renderWithLoading()

            await waitFor(() => expect(global.fetch).toHaveBeenCalled())
            expect(mockReload).not.toHaveBeenCalled()
        })

        it('clears the attempt latch once the bundle is current again', async () => {
            sessionStorage.setItem('peanut-stale-deploy-attempted', '1')
            serveCommit(BUILD_COMMIT)
            renderWithLoading()

            await waitFor(() => expect(sessionStorage.getItem('peanut-stale-deploy-attempted')).toBeNull())
        })

        it('reloads at most once per mount', async () => {
            serveCommit(NEW_COMMIT)
            const { rerender } = renderWithLoading()

            await waitFor(() => expect(mockReload).toHaveBeenCalledTimes(1))

            mockPathname = '/profile'
            rerender()
            mockPathname = '/history'
            rerender()

            expect(mockReload).toHaveBeenCalledTimes(1)
        })
    })

    it('ignores a non-ok version response', async () => {
        serveCommit(NEW_COMMIT, false)
        renderWithLoading()

        await waitFor(() => expect(global.fetch).toHaveBeenCalled())
        expect(mockReload).not.toHaveBeenCalled()
    })

    it('survives an unreachable version endpoint', async () => {
        global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch
        renderWithLoading()

        await waitFor(() => expect(global.fetch).toHaveBeenCalled())
        expect(mockReload).not.toHaveBeenCalled()
    })

    /**
     * Native bounds the document's age rather than the deployment's: the WebView
     * never reloads on its own, so a wedged module-level promise or accumulated
     * heap persists until the user force-quits.
     */
    describe('native document age', () => {
        beforeEach(() => {
            mockIsCapacitor.mockReturnValue(true)
        })

        it('reloads on resume once the document is old enough', async () => {
            setDocumentAge(TWELVE_HOURS_MS)
            renderWithLoading()

            await resumeApp()

            await waitFor(() => expect(mockReload).toHaveBeenCalledTimes(1))
        })

        it('leaves a young document alone', async () => {
            setDocumentAge(TWELVE_HOURS_MS - 60_000)
            renderWithLoading()

            await resumeApp()

            expect(mockReload).not.toHaveBeenCalled()
        })

        it('never checks the version endpoint — there is no deployment to be stale against', async () => {
            setDocumentAge(TWELVE_HOURS_MS)
            global.fetch = jest.fn() as unknown as typeof fetch
            renderWithLoading()

            await resumeApp()

            expect(global.fetch).not.toHaveBeenCalled()
        })

        it('waits rather than interrupting a pending transaction', async () => {
            setDocumentAge(TWELVE_HOURS_MS)
            mockPendingCount = 1
            renderWithLoading()

            await resumeApp()

            expect(mockReload).not.toHaveBeenCalled()
        })

        it('waits rather than interrupting a flow whose state is only in memory', async () => {
            setDocumentAge(TWELVE_HOURS_MS)
            mockPathname = '/kyc'
            renderWithLoading()

            await resumeApp()

            expect(mockReload).not.toHaveBeenCalled()
        })

        it('reloads at the route-change boundary too', async () => {
            setDocumentAge(TWELVE_HOURS_MS)
            mockPathname = '/kyc'
            const { rerender } = renderWithLoading()

            await resumeApp()
            expect(mockReload).not.toHaveBeenCalled()

            mockPathname = '/home'
            rerender()

            await waitFor(() => expect(mockReload).toHaveBeenCalledTimes(1))
        })

        it('does not purge the web service worker caches', async () => {
            setDocumentAge(TWELVE_HOURS_MS)
            renderWithLoading()

            await resumeApp()

            await waitFor(() => expect(mockReload).toHaveBeenCalled())
            expect(mockPurgeCaches).not.toHaveBeenCalled()
        })

        it('does not set the one-attempt latch, which only makes sense for a deployment mismatch', async () => {
            setDocumentAge(TWELVE_HOURS_MS)
            renderWithLoading()

            await resumeApp()

            await waitFor(() => expect(mockReload).toHaveBeenCalled())
            expect(sessionStorage.getItem('peanut-stale-deploy-attempted')).toBeNull()
        })

        it('honours the reload guard so a resume storm cannot loop', async () => {
            sessionStorage.setItem('peanut-stale-deploy-reload-at', String(Date.now()))
            setDocumentAge(TWELVE_HOURS_MS)
            renderWithLoading()

            await resumeApp()

            expect(mockReload).not.toHaveBeenCalled()
        })
    })
})
