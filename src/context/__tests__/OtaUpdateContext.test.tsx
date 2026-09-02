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
}
const mockExitApp = jest.fn().mockResolvedValue(undefined)
const platform = { android: true }

jest.mock('@capgo/capacitor-updater', () => ({ CapacitorUpdater: mockUpdater }))
jest.mock('@capacitor/app', () => ({ App: { exitApp: () => mockExitApp() } }))
jest.mock('@/utils/demo', () => ({ isDemoMode: () => false }))
jest.mock('@/utils/capacitor', () => ({
    isCapacitor: () => true,
    isAndroidNativeBridge: () => platform.android,
}))

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
    mockExitApp.mockClear()
    mockUpdater.set.mockReset().mockReturnValue(new Promise(() => {}))
    mockUpdater.reload.mockClear()
    mockUpdater.getNextBundle.mockResolvedValue(null)
    mockUpdater.getLatest.mockReset().mockRejectedValue(new Error('no_new_version_available'))
    mockUpdater.current.mockResolvedValue({ bundle: { id: 'builtin' } })
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
