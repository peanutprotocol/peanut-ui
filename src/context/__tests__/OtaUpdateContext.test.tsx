/**
 * Restart-to-apply contract: the pending bundle survives a reload (seeded from
 * the plugin queue, not only from this launch's check), a store-only update is
 * surfaced as such, and a rejected set() never strands the user on the old
 * bundle — it re-stages, reloads under the re-staged id, and failing that closes
 * the app (Android) or asks for a manual restart (iOS). An apply that never
 * reaches the plugin at all (offline re-stage, rejected reload) must NOT restart
 * anything: it clears the watchdog and the pending-apply marker and comes back
 * retriable.
 */
import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'

const mockUpdater = {
    notifyAppReady: jest.fn().mockResolvedValue(undefined),
    addListener: jest.fn().mockResolvedValue({ remove: jest.fn() }),
    getLatest: jest.fn(),
    download: jest.fn(),
    next: jest.fn().mockResolvedValue(undefined),
    set: jest.fn(),
    reload: jest.fn().mockResolvedValue(undefined),
    current: jest.fn().mockResolvedValue({ bundle: { id: 'builtin' } }),
    getNextBundle: jest.fn(),
    getPluginVersion: jest.fn(),
    getFailedUpdate: jest.fn().mockResolvedValue(null),
}
const mockExitApp = jest.fn().mockResolvedValue(undefined)
// splashVisible false by default: these cases are about a bundle staged while
// the user is already in the app, where the launch apply deliberately stands
// down. The behind-the-splash window has its own describe block.
const platform = { android: true, capacitor: true, splashVisible: false }

jest.mock('@capgo/capacitor-updater', () => ({ CapacitorUpdater: mockUpdater }))
jest.mock('@capacitor/app', () => ({ App: { exitApp: () => mockExitApp() } }))
jest.mock('@/utils/demo', () => ({ isDemoMode: () => false }))
jest.mock('@/utils/capacitor', () => ({
    isCapacitor: () => platform.capacitor,
    isAndroidNativeBridge: () => platform.android,
}))
jest.mock('@/hooks/useSplashGate', () => ({ isSplashVisible: () => platform.splashVisible }))

import { OtaUpdateProvider, useOtaUpdate } from '../OtaUpdateContext'

const STAGED = { id: 'b-2', version: '1.2.0', downloaded: '', checksum: '', status: 'pending' as const }

const wrapper = ({ children }: { children: React.ReactNode }) => <OtaUpdateProvider>{children}</OtaUpdateProvider>
const setup = () => renderHook(() => useOtaUpdate(), { wrapper })

let warn: jest.SpyInstance
let error: jest.SpyInstance

beforeEach(() => {
    jest.useFakeTimers()
    window.localStorage.clear()
    platform.android = true
    platform.capacitor = true
    platform.splashVisible = false
    mockUpdater.getFailedUpdate.mockReset().mockResolvedValue(null)
    mockExitApp.mockClear()
    mockUpdater.set.mockReset().mockReturnValue(new Promise(() => {}))
    mockUpdater.reload.mockClear()
    mockUpdater.getNextBundle.mockResolvedValue(null)
    mockUpdater.getLatest.mockReset().mockRejectedValue(new Error('no_new_version_available'))
    mockUpdater.current.mockResolvedValue({ bundle: { id: 'builtin' } })
    // A binary whose plugin restarts in place without deadlocking, so the
    // existing cases still exercise the set() path.
    mockUpdater.getPluginVersion.mockReset().mockResolvedValue({ version: '8.51.15' })
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    error = jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
})

/** The recovery path after a rejected set(): a genuinely newer bundle to re-stage. */
const withRestageableBundle = () => {
    mockUpdater.getLatest.mockReset().mockResolvedValue({ url: 'https://cdn.test/b-3.zip', version: '1.3.0' })
    mockUpdater.download.mockResolvedValue({ ...STAGED, id: 'b-3', version: '1.3.0' })
}

const withStagedBundle = async () => {
    mockUpdater.getNextBundle.mockResolvedValue(STAGED)
    const rendered = setup()
    await waitFor(() => expect(rendered.result.current.pendingBundle).toEqual(STAGED))
    return rendered
}

it('seeds the pending bundle from the plugin queue, so it survives a reload', async () => {
    const { result } = await withStagedBundle()
    expect(result.current.storeUpdateRequired).toBe(false)
})

it('flags a store update when the served bundle needs a newer binary', async () => {
    mockUpdater.getLatest.mockRejectedValue(new Error('disable_auto_update_to_major'))
    const { result } = setup()
    await act(async () => {
        await jest.advanceTimersByTimeAsync(5_000)
    })
    expect(result.current.storeUpdateRequired).toBe(true)
    expect(window.localStorage.getItem('capgoUpdateFailureStreak')).toBeNull()
})

it('applyNow records the marker and hands the bundle to set()', async () => {
    const { result } = await withStagedBundle()
    act(() => {
        void result.current.applyNow()
    })
    await waitFor(() => expect(mockUpdater.set).toHaveBeenCalledWith({ id: 'b-2' }))
    expect(window.localStorage.getItem('capgoPendingApply')).toBe('b-2')
    expect(result.current.applyState).toBe('applying')
    // set() reloads the page and never settles, so no re-stage runs; if the
    // page is somehow still alive after the grace period the app is closed
    await act(async () => {
        await jest.advanceTimersByTimeAsync(3_000)
    })
    expect(mockUpdater.reload).not.toHaveBeenCalled()
    expect(mockExitApp).toHaveBeenCalled()
})

describe('Android binaries whose plugin deadlocks on an in-place restart', () => {
    // Capgo < 8.46.0 runs set() inline on Capacitor's single plugin thread and
    // blocks it waiting for notifyAppReady(), which is queued behind it there —
    // the page reloads onto a blank screen for 30 s and the bundle is rolled
    // back. Those binaries must quit instead; next() already staged the bundle.
    beforeEach(() => {
        mockUpdater.getPluginVersion.mockResolvedValue({ version: '8.45.9' })
    })

    it('quits instead of calling set(), keeping the marker on the staged bundle', async () => {
        const { result } = await withStagedBundle()
        await act(async () => {
            await result.current.applyNow()
        })
        expect(mockUpdater.set).not.toHaveBeenCalled()
        expect(mockExitApp).toHaveBeenCalled()
        expect(window.localStorage.getItem('capgoPendingApply')).toBe('b-2')
        expect(result.current.applyState).toBe('manual-restart')
    })

    it('leaves the close-and-reopen instruction up when the exit fails', async () => {
        mockExitApp.mockRejectedValueOnce(new Error('exitApp unavailable'))
        const { result } = await withStagedBundle()
        await act(async () => {
            await result.current.applyNow()
        })
        expect(result.current.applyState).toBe('manual-restart')
    })

    it('arms no watchdog, so a user who never reopens is not exited twice', async () => {
        const { result } = await withStagedBundle()
        await act(async () => {
            await result.current.applyNow()
        })
        mockExitApp.mockClear()
        await act(async () => {
            await jest.advanceTimersByTimeAsync(3_000)
        })
        expect(mockExitApp).not.toHaveBeenCalled()
    })

    it('treats an unreadable plugin version as deadlocking rather than risking the bundle', async () => {
        mockUpdater.getPluginVersion.mockRejectedValue(new Error('not implemented'))
        const { result } = await withStagedBundle()
        await act(async () => {
            await result.current.applyNow()
        })
        expect(mockUpdater.set).not.toHaveBeenCalled()
        expect(mockExitApp).toHaveBeenCalled()
    })

    it('still restarts in place on iOS, where the plugin does not block the caller', async () => {
        platform.android = false
        const { result } = await withStagedBundle()
        act(() => {
            void result.current.applyNow()
        })
        await waitFor(() => expect(mockUpdater.set).toHaveBeenCalledWith({ id: 'b-2' }))
        expect(mockExitApp).not.toHaveBeenCalled()
    })
})

it('re-stages and reloads when set() rejects, then closes the app on Android', async () => {
    mockUpdater.set.mockRejectedValue(new Error('no index.html'))
    withRestageableBundle()
    const { result } = await withStagedBundle()
    await act(async () => {
        await result.current.applyNow()
    })
    expect(mockUpdater.getLatest).toHaveBeenCalled()
    expect(mockUpdater.reload).toHaveBeenCalled()
    expect(mockExitApp).not.toHaveBeenCalled()
    await act(async () => {
        await jest.advanceTimersByTimeAsync(3_000)
    })
    expect(mockExitApp).toHaveBeenCalled()
    expect(result.current.applyState).toBe('applying')
})

it('falls back to the manual-restart instruction when the Android exit fails', async () => {
    // exitApp rejecting (or its chunk failing to load) used to leave applyState on
    // 'applying' forever: the modal hides its close button, disables both CTAs and
    // blocks dismissal, so the user had no way out and no instruction.
    mockExitApp.mockRejectedValueOnce(new Error('exitApp unavailable'))
    mockUpdater.set.mockRejectedValue(new Error('no index.html'))
    withRestageableBundle()
    const { result } = await withStagedBundle()
    await act(async () => {
        await result.current.applyNow()
    })
    await act(async () => {
        await jest.advanceTimersByTimeAsync(3_000)
    })
    expect(mockExitApp).toHaveBeenCalled()
    await waitFor(() => expect(result.current.applyState).toBe('manual-restart'))
})

it('asks for a manual restart on iOS when the reload never happened', async () => {
    platform.android = false
    mockUpdater.set.mockRejectedValue(new Error('no index.html'))
    withRestageableBundle()
    const { result } = await withStagedBundle()
    await act(async () => {
        await result.current.applyNow()
    })
    await act(async () => {
        await jest.advanceTimersByTimeAsync(3_000)
    })
    expect(mockExitApp).not.toHaveBeenCalled()
    expect(result.current.applyState).toBe('manual-restart')
})

it('reports on the next launch whether the restart applied the bundle', async () => {
    window.localStorage.setItem('capgoPendingApply', 'b-2')
    mockUpdater.current.mockResolvedValue({ bundle: { id: 'b-2' } })
    setup()
    await waitFor(() => expect(warn).toHaveBeenCalledWith('[capgo-apply] restart applied bundle b-2'))
    expect(window.localStorage.getItem('capgoPendingApply')).toBeNull()
    expect(error).not.toHaveBeenCalled()
})

it('escalates a restart that left the old bundle running', async () => {
    window.localStorage.setItem('capgoPendingApply', 'b-2')
    mockUpdater.current.mockResolvedValue({ bundle: { id: 'b-1' } })
    setup()
    await waitFor(() =>
        expect(error).toHaveBeenCalledWith('[capgo-apply] restart did not apply bundle b-2; running b-1')
    )
    expect(window.localStorage.getItem('capgoPendingApply')).toBeNull()
})

it('retargets the marker to the re-staged bundle, so the recovered launch reads as a success', async () => {
    mockUpdater.set.mockRejectedValue(new Error('no index.html'))
    withRestageableBundle()
    const { result } = await withStagedBundle()
    await act(async () => {
        await result.current.applyNow()
    })
    expect(mockUpdater.reload).toHaveBeenCalled()
    // reload() applies b-3, not the b-2 that set() rejected
    expect(window.localStorage.getItem('capgoPendingApply')).toBe('b-3')

    mockUpdater.current.mockResolvedValue({ bundle: { id: 'b-3' } })
    setup()
    await waitFor(() => expect(warn).toHaveBeenCalledWith('[capgo-apply] restart applied bundle b-3'))
    expect(error).not.toHaveBeenCalled()
})

it('drops the marker while the recovery re-stage is in flight, so a kill is not reported as a failed apply', async () => {
    // The marker is the next launch's evidence that an apply was attempted and
    // lost. While the re-download runs, the rejected id was never handed to the
    // plugin, so a process death here must not surface an error-level failure
    // for a bundle nothing tried to activate.
    mockUpdater.set.mockRejectedValue(new Error('no index.html'))
    let markerDuringRestage: string | null | undefined
    mockUpdater.getLatest.mockReset().mockImplementation(async () => {
        markerDuringRestage = window.localStorage.getItem('capgoPendingApply')
        return { url: 'https://cdn.test/b-3.zip', version: '1.3.0' }
    })
    mockUpdater.download.mockResolvedValue({ ...STAGED, id: 'b-3', version: '1.3.0' })
    const { result } = await withStagedBundle()

    await act(async () => {
        await result.current.applyNow()
    })

    expect(mockUpdater.reload).toHaveBeenCalled()
    expect(markerDuringRestage).toBeNull()
    // and it is back, pointed at the bundle reload() actually applies
    expect(window.localStorage.getItem('capgoPendingApply')).toBe('b-3')
})

it('does not exit while the fallback re-download is still running after set() rejects', async () => {
    mockUpdater.set.mockRejectedValue(new Error('no index.html'))
    let finishDownload!: () => void
    mockUpdater.getLatest.mockReset().mockReturnValue(
        new Promise((resolve) => {
            finishDownload = () => resolve({ url: 'https://cdn.test/b-3.zip', version: '1.3.0' })
        })
    )
    mockUpdater.download.mockResolvedValue({ ...STAGED, id: 'b-3', version: '1.3.0' })
    const { result } = await withStagedBundle()

    act(() => {
        void result.current.applyNow()
    })
    // the recovery download outlives the set() watchdog: nothing may exit yet
    await act(async () => {
        await jest.advanceTimersByTimeAsync(5_000)
    })
    expect(mockExitApp).not.toHaveBeenCalled()
    expect(mockUpdater.reload).not.toHaveBeenCalled()

    await act(async () => {
        finishDownload()
        await Promise.resolve()
    })
    await waitFor(() => expect(mockUpdater.reload).toHaveBeenCalled())
    expect(mockExitApp).not.toHaveBeenCalled()

    // reload() issued and the page is still here: now the fallback applies
    await act(async () => {
        await jest.advanceTimersByTimeAsync(3_000)
    })
    expect(mockExitApp).toHaveBeenCalled()
})

describe('a set() that resolves instead of reloading', () => {
    /*
     * The plugin's contract is that set() tears the page down, so its promise
     * never settles — but a build where it resolves without reloading (a plugin
     * that no-ops after a failed download) must not strand the modal on
     * 'applying': it hides its close button and shows a loading CTA, so the
     * watchdog armed before set() is the only way back out.
     */
    beforeEach(() => {
        mockUpdater.set.mockReset().mockResolvedValue(undefined)
    })

    it('closes the app on Android once the grace period passes', async () => {
        const { result } = await withStagedBundle()
        await act(async () => {
            await result.current.applyNow()
        })
        expect(mockExitApp).not.toHaveBeenCalled()

        await act(async () => {
            await jest.advanceTimersByTimeAsync(3_000)
        })
        expect(mockExitApp).toHaveBeenCalled()
    })

    it('asks for a manual restart off Android', async () => {
        platform.android = false
        const { result } = await withStagedBundle()
        await act(async () => {
            await result.current.applyNow()
        })
        expect(result.current.applyState).toBe('applying')

        await act(async () => {
            await jest.advanceTimersByTimeAsync(3_000)
        })
        expect(result.current.applyState).toBe('manual-restart')
        expect(mockExitApp).not.toHaveBeenCalled()
    })
})

it('has nothing to apply off native, so no restart can be offered there', async () => {
    // The restart is native-only: the check that stages a bundle never runs off
    // Capacitor, so `pendingBundle` stays null and applyNow returns before it
    // can put the modal into 'applying' — including in a web preview build.
    platform.capacitor = false
    mockUpdater.getNextBundle.mockResolvedValue(STAGED)
    const { result } = setup()
    await act(async () => {
        await jest.advanceTimersByTimeAsync(5_000)
    })

    expect(result.current.pendingBundle).toBeNull()
    await act(async () => {
        await result.current.applyNow()
    })
    expect(mockUpdater.set).not.toHaveBeenCalled()
    expect(result.current.applyState).toBe('idle')
})

it('reports no failed apply when the marker retarget cannot be written', async () => {
    // Storage can refuse a write mid-session (quota, site data blocked). The
    // marker is dropped before the re-stage, so a refused retarget leaves NO
    // marker rather than the dead id — the recovered launch has nothing to
    // compare against and stays quiet, instead of logging a phantom failed
    // apply at error level for a bundle the recovery replaced.
    const write = Storage.prototype.setItem
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
        if (value === 'b-3') throw new Error('QuotaExceededError')
        write.call(this, key, value)
    })
    mockUpdater.set.mockRejectedValue(new Error('no index.html'))
    withRestageableBundle()
    const { result } = await withStagedBundle()

    await act(async () => {
        await result.current.applyNow()
    })
    expect(mockUpdater.reload).toHaveBeenCalled()
    expect(window.localStorage.getItem('capgoPendingApply')).toBeNull()

    mockUpdater.current.mockResolvedValue({ bundle: { id: 'b-3' } })
    setup()
    await act(async () => {
        await jest.advanceTimersByTimeAsync(0)
    })
    expect(error).not.toHaveBeenCalled()
})

describe('an apply that never reaches the plugin', () => {
    // reload() would restart the app onto the bundle it is already running, and
    // the watchdog would then exit it (Android) or tell the user to close it
    // (iOS) for an update that was never staged.
    it.each([
        ['offline', new Error('Network request failed')],
        ['up to date', new Error('no_new_version_available')],
    ])('abandons the apply when the re-stage comes back %s', async (_label, rejection) => {
        mockUpdater.set.mockRejectedValue(new Error('no index.html'))
        mockUpdater.getLatest.mockReset().mockRejectedValue(rejection)
        const { result } = await withStagedBundle()

        await act(async () => {
            await result.current.applyNow()
        })
        expect(mockUpdater.reload).not.toHaveBeenCalled()
        expect(result.current.applyState).toBe('failed')
        // the next launch must not report a phantom failed apply at error level
        expect(window.localStorage.getItem('capgoPendingApply')).toBeNull()

        await act(async () => {
            await jest.advanceTimersByTimeAsync(3_000)
        })
        expect(mockExitApp).not.toHaveBeenCalled()
        expect(result.current.applyState).toBe('failed')
    })

    it('abandons the apply when reload() itself rejects', async () => {
        mockUpdater.set.mockRejectedValue(new Error('no index.html'))
        withRestageableBundle()
        mockUpdater.reload.mockRejectedValue(new Error('reload refused'))
        const { result } = await withStagedBundle()

        await act(async () => {
            await result.current.applyNow()
        })
        expect(result.current.applyState).toBe('failed')
        await act(async () => {
            await jest.advanceTimersByTimeAsync(3_000)
        })
        expect(mockExitApp).not.toHaveBeenCalled()
    })

    // The re-stage mints a new id; a retry that still held the dead one would
    // hand set() exactly the id it just rejected.
    it('adopts the re-staged bundle when the reload fails after a successful re-stage', async () => {
        mockUpdater.set.mockRejectedValue(new Error('no index.html'))
        withRestageableBundle()
        mockUpdater.reload.mockRejectedValue(new Error('reload refused'))
        const { result } = await withStagedBundle()

        await act(async () => {
            await result.current.applyNow()
        })
        expect(result.current.applyState).toBe('failed')
        expect(result.current.pendingBundle?.id).toBe('b-3')
    })

    it('applies once when the CTA is tapped twice in the same tick', async () => {
        const { result } = await withStagedBundle()
        act(() => {
            void result.current.applyNow()
            void result.current.applyNow()
        })
        await waitFor(() => expect(mockUpdater.set).toHaveBeenCalled())
        expect(mockUpdater.set).toHaveBeenCalledTimes(1)
    })

    it('stays retriable — a second attempt runs and can succeed', async () => {
        mockUpdater.set.mockRejectedValue(new Error('no index.html'))
        mockUpdater.getLatest.mockReset().mockRejectedValue(new Error('Network request failed'))
        const { result } = await withStagedBundle()
        await act(async () => {
            await result.current.applyNow()
        })
        expect(result.current.applyState).toBe('failed')

        mockUpdater.set.mockReset().mockReturnValue(new Promise(() => {}))
        act(() => {
            void result.current.applyNow()
        })
        await waitFor(() => expect(mockUpdater.set).toHaveBeenCalledWith({ id: 'b-2' }))
        expect(result.current.applyState).toBe('applying')
    })
})

describe('a bundle staged by an earlier launch, found while the splash is still up', () => {
    /*
     * next() is only ever consumed by installNext(), which runs from
     * appMovedToBackground() — so the reload lands in a process the OS is about
     * to freeze, and on resume every overdue chunk-load timer rejects at once
     * (PEANUT-UI-SVT). Applying it here instead reloads an app that is on
     * screen, running at full speed, and still behind its own splash.
     */
    beforeEach(() => {
        platform.splashVisible = true
    })

    it('applies it immediately rather than leaving it to the background apply', async () => {
        mockUpdater.getNextBundle.mockResolvedValue(STAGED)
        setup()
        await waitFor(() => expect(mockUpdater.set).toHaveBeenCalledWith({ id: 'b-2' }))
        expect(window.localStorage.getItem('capgoPendingApply')).toBe('b-2')
    })

    it('still surfaces the bundle, so a rejected apply leaves a restart to offer', async () => {
        mockUpdater.set.mockReset().mockRejectedValue(new Error('no index.html'))
        mockUpdater.getNextBundle.mockResolvedValue(STAGED)
        const { result } = setup()
        await waitFor(() => expect(result.current.pendingBundle).toEqual(STAGED))
        // The apply never reached the plugin, so the next launch must not report
        // it as one that did.
        expect(window.localStorage.getItem('capgoPendingApply')).toBeNull()
    })

    it('tries a given bundle once, so a set() that never lands cannot reload every launch', async () => {
        mockUpdater.getNextBundle.mockResolvedValue(STAGED)
        setup()
        await waitFor(() => expect(mockUpdater.set).toHaveBeenCalledTimes(1))
        mockUpdater.set.mockClear()
        setup()
        await act(async () => {
            await jest.advanceTimersByTimeAsync(5_000)
        })
        expect(mockUpdater.set).not.toHaveBeenCalled()
    })

    it('stands down on binaries that would deadlock, leaving the background apply to it', async () => {
        mockUpdater.getPluginVersion.mockResolvedValue({ version: '8.45.9' })
        mockUpdater.getNextBundle.mockResolvedValue(STAGED)
        const { result } = setup()
        await waitFor(() => expect(result.current.pendingBundle).toEqual(STAGED))
        expect(mockUpdater.set).not.toHaveBeenCalled()
        expect(mockExitApp).not.toHaveBeenCalled()
    })

    it('does nothing when the staged bundle is already the running one', async () => {
        mockUpdater.getNextBundle.mockResolvedValue(STAGED)
        mockUpdater.current.mockResolvedValue({ bundle: { id: STAGED.id } })
        setup()
        await act(async () => {
            await jest.advanceTimersByTimeAsync(5_000)
        })
        expect(mockUpdater.set).not.toHaveBeenCalled()
    })
})

describe('rollbacks the plugin performed while no page could report them', () => {
    it('reports the plugin-recorded failure at launch, under a prefix Sentry keeps', async () => {
        mockUpdater.getFailedUpdate.mockResolvedValue({ bundle: { id: 'b-9', version: '1.0.56' } })
        setup()
        await waitFor(() =>
            expect(error).toHaveBeenCalledWith(
                expect.stringContaining('[capgo-apply] plugin rolled back bundle 1.0.56')
            )
        )
    })

    it('stays quiet on binaries whose plugin has no such record', async () => {
        mockUpdater.getFailedUpdate.mockRejectedValue(new Error('not implemented'))
        setup()
        await act(async () => {
            await jest.advanceTimersByTimeAsync(5_000)
        })
        expect(error).not.toHaveBeenCalledWith(expect.stringContaining('[capgo-apply]'))
    })
})
