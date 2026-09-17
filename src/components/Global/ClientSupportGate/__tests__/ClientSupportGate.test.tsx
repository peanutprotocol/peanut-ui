/**
 * The gate's contract: only a live `supported` verdict mounts the app tree; a
 * remembered block holds without the network; a remembered "supported" admits
 * nothing; a benign resume recheck and a failed resume read keep the tree
 * mounted (same instance) but inert under a cover; a known block unmounts it;
 * listeners and in-flight reads are cleaned up per effect run.
 */
import React, { useEffect } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CLIENT_SUPPORT_POLICY_STORAGE_KEY } from '@/constants/client-support.consts'

const platform = { current: 'web' as 'web' | 'android-native', capacitor: false }
jest.mock('@/utils/capacitor', () => ({
    ...jest.requireActual('@/utils/capacitor'),
    isCapacitor: () => platform.capacitor,
    getPlatform: () => platform.current,
    getApiBaseUrl: () => '',
    openExternalUrl: jest.fn(),
}))
jest.mock('@/dev/fixtures/active', () => ({ ensureActiveFixture: () => null }))
// The gate's only dynamic import is its intl provider; the test catalog stands in.
jest.mock('next/dynamic', () => ({
    __esModule: true,
    default: () => (require('@/test-utils/intl') as typeof import('@/test-utils/intl')).IntlWrapper,
}))
jest.mock('@/context/OtaUpdateContext', () => ({
    useOtaUpdate: () => ({
        pendingBundle: null,
        storeUpdateRequired: false,
        applyState: 'idle',
        applyNow: jest.fn(),
        checkNow: jest.fn(async () => 'unavailable'),
    }),
}))
const nativeListener = { handler: null as null | ((state: { isActive: boolean }) => void), removed: 0 }
let resolveRegistration: (() => void) | null = null
jest.mock('@capacitor/app', () => ({
    App: {
        addListener: (_event: string, handler: (state: { isActive: boolean }) => void) =>
            new Promise((resolve) => {
                nativeListener.handler = handler
                const handle = { remove: async () => void (nativeListener.removed += 1) }
                resolveRegistration = () => resolve(handle)
            }),
    },
}))

import { ClientSupportGate } from '..'

const ZERO = { schemaVersion: 1, minimumGeneration: { web: 0, ios: 0, android: 0 } }
const BLOCK_WEB = { schemaVersion: 1, minimumGeneration: { web: 99, ios: 0, android: 0 } }

const fetchMock = jest.fn()
let settle: Array<(body: unknown | Error) => void> = []
/** Every fetch parks until the test answers it, in order. */
function parkFetches() {
    fetchMock.mockImplementation(
        () =>
            new Promise((resolve, reject) => {
                settle.push((body) =>
                    body instanceof Error ? reject(body) : resolve({ ok: true, json: async () => body } as Response)
                )
            })
    )
}
// The read reaches fetch a microtask after it starts (the fixture lookup is
// awaited first), so wait for it to park before answering.
const fetches = async (count: number) => {
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(count))
}
const answer = async (body: unknown | Error) => {
    await waitFor(() => expect(settle.length).toBeGreaterThan(0))
    const next = settle.shift()!
    await act(async () => {
        next(body)
    })
}

const mounts = { count: 0, unmounts: 0 }
function Wallet() {
    useEffect(() => {
        mounts.count += 1
        return () => {
            mounts.unmounts += 1
        }
    }, [])
    return <button data-testid="wallet">wallet</button>
}

const renderGate = (enabled = true) =>
    render(
        <ClientSupportGate enabled={enabled}>
            <Wallet />
        </ClientSupportGate>
    )

const resume = () => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    act(() => {
        document.dispatchEvent(new Event('visibilitychange'))
    })
}

beforeEach(() => {
    window.localStorage.clear()
    platform.current = 'web'
    platform.capacitor = false
    mounts.count = 0
    mounts.unmounts = 0
    settle = []
    nativeListener.handler = null
    nativeListener.removed = 0
    resolveRegistration = null
    fetchMock.mockReset()
    parkFetches()
    global.fetch = fetchMock as unknown as typeof fetch
})

describe('startup', () => {
    it('shows the loader, not the wallet, until the live policy answers', async () => {
        renderGate()
        expect(screen.getByRole('status')).toBeInTheDocument()
        expect(screen.queryByTestId('wallet')).not.toBeInTheDocument()
        await fetches(1)

        await answer(ZERO)
        expect(screen.getByTestId('wallet')).toBeInTheDocument()
        expect(screen.queryByRole('status')).not.toBeInTheDocument()
        expect(mounts.count).toBe(1)
    })

    it('never admits on a remembered "supported" alone: it waits for the live read and blocks on failure', async () => {
        window.localStorage.setItem(CLIENT_SUPPORT_POLICY_STORAGE_KEY, JSON.stringify(ZERO))
        renderGate()
        expect(screen.queryByTestId('wallet')).not.toBeInTheDocument()

        await answer(new TypeError('offline'))
        expect(screen.queryByTestId('wallet')).not.toBeInTheDocument()
        expect(screen.getByText("Couldn't check this version")).toBeInTheDocument()

        // retry reaches the network again and a live zero floor admits normally
        fireEvent.click(screen.getByRole('button', { name: /Try again/ }))
        await fetches(2)
        await answer(ZERO)
        expect(screen.getByTestId('wallet')).toBeInTheDocument()
    })

    it('holds a remembered block at once, offline included, and never mounts the wallet', async () => {
        window.localStorage.setItem(CLIENT_SUPPORT_POLICY_STORAGE_KEY, JSON.stringify(BLOCK_WEB))
        renderGate()
        expect(screen.getByText('Update Peanut to continue')).toBeInTheDocument()

        await answer(new TypeError('offline'))
        expect(screen.getByText('Update Peanut to continue')).toBeInTheDocument()
        expect(screen.queryByTestId('wallet')).not.toBeInTheDocument()
        expect(mounts.count).toBe(0)
    })

    it('blocks on a live unsupported verdict and offers no dismissal', async () => {
        renderGate()
        await answer(BLOCK_WEB)
        expect(screen.getByText('Update Peanut to continue')).toBeInTheDocument()
        expect(screen.queryByTestId('wallet')).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /not now|close|got it/i })).not.toBeInTheDocument()
        expect(JSON.parse(window.localStorage.getItem(CLIENT_SUPPORT_POLICY_STORAGE_KEY)!)).toEqual(BLOCK_WEB)
    })

    it('keeps a remembered block when the live policy is malformed', async () => {
        window.localStorage.setItem(CLIENT_SUPPORT_POLICY_STORAGE_KEY, JSON.stringify(BLOCK_WEB))
        renderGate()
        await answer({ schemaVersion: 1, minimumGeneration: { web: 0 } })
        expect(screen.getByText('Update Peanut to continue')).toBeInTheDocument()
        expect(screen.queryByTestId('wallet')).not.toBeInTheDocument()
    })

    it('requires a new live decision after returning from a marketing route', async () => {
        const { rerender } = renderGate()
        await answer(ZERO)
        rerender(
            <ClientSupportGate enabled={false}>
                <div>marketing</div>
            </ClientSupportGate>
        )
        rerender(
            <ClientSupportGate enabled>
                <Wallet />
            </ClientSupportGate>
        )
        expect(screen.queryByTestId('wallet')).not.toBeInTheDocument()
        expect(mounts.count).toBe(1)
        await answer(BLOCK_WEB)
        expect(screen.getByText('Update Peanut to continue')).toBeInTheDocument()
        expect(mounts.count).toBe(1)
    })

    it('is off on marketing routes: no read, children straight through', () => {
        renderGate(false)
        expect(screen.getByTestId('wallet')).toBeInTheDocument()
        expect(fetchMock).not.toHaveBeenCalled()
    })
})

describe('resume', () => {
    const admitted = async () => {
        const rendered = renderGate()
        await answer(ZERO)
        expect(mounts.count).toBe(1)
        return rendered
    }

    it('covers the mounted wallet while a recheck runs and restores it without remounting', async () => {
        await admitted()
        resume()
        await fetches(2)
        const wallet = screen.getByTestId('wallet')
        expect(wallet.parentElement).toHaveAttribute('aria-hidden', 'true')
        expect(wallet.parentElement).toHaveAttribute('inert')
        expect(screen.getByRole('status')).toBeInTheDocument()

        await answer(ZERO)
        expect(screen.getByTestId('wallet')).toBe(wallet)
        expect(wallet.parentElement).not.toHaveAttribute('inert')
        expect(mounts.count).toBe(1)
        expect(mounts.unmounts).toBe(0)
    })

    it('keeps the wallet mounted but unreachable behind a retry cover when the read fails', async () => {
        await admitted()
        resume()
        await answer(new TypeError('offline'))
        const wallet = screen.getByTestId('wallet')
        expect(wallet.parentElement).toHaveAttribute('inert')
        expect(screen.getByText("Couldn't check this version")).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: /Try again/ }))
        await answer(ZERO)
        expect(screen.getByTestId('wallet')).toBe(wallet)
        expect(wallet.parentElement).not.toHaveAttribute('inert')
        expect(mounts.count).toBe(1)
    })

    it('unmounts the wallet on a live unsupported verdict', async () => {
        await admitted()
        resume()
        await answer(BLOCK_WEB)
        expect(screen.queryByTestId('wallet')).not.toBeInTheDocument()
        expect(mounts.unmounts).toBe(1)
        expect(screen.getByText('Update Peanut to continue')).toBeInTheDocument()
    })

    it('runs one read for a burst of focus events', async () => {
        await admitted()
        resume()
        resume()
        resume()
        await fetches(2)
        await answer(ZERO)
        expect(fetchMock).toHaveBeenCalledTimes(2)
        expect(screen.getByTestId('wallet')).toBeInTheDocument()
    })

    it('ignores a hidden tab', async () => {
        await admitted()
        Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
        act(() => {
            document.dispatchEvent(new Event('visibilitychange'))
        })
        await act(async () => {})
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })
})

describe('lifecycle', () => {
    it('stops listening on unmount and drops a read that lands afterwards', async () => {
        const { unmount } = renderGate()
        await fetches(1)
        unmount()
        resume()
        await act(async () => {})
        expect(fetchMock).toHaveBeenCalledTimes(1)
        await expect(answer(ZERO)).resolves.toBeUndefined()
    })

    it('registers the native resume listener and removes it, even when registration finishes after cleanup', async () => {
        platform.capacitor = true
        platform.current = 'android-native'
        const { unmount } = renderGate()
        await waitFor(() => expect(resolveRegistration).not.toBeNull())
        unmount()
        await act(async () => {
            resolveRegistration!()
        })
        await waitFor(() => expect(nativeListener.removed).toBe(1))
    })

    it('rechecks on the native resume event and removes the listener on unmount', async () => {
        platform.capacitor = true
        platform.current = 'android-native'
        const { unmount } = renderGate()
        await answer(ZERO)
        await waitFor(() => expect(resolveRegistration).not.toBeNull())
        await act(async () => {
            resolveRegistration!()
        })
        act(() => {
            nativeListener.handler!({ isActive: true })
        })
        await fetches(2)
        await answer(ZERO)
        unmount()
        expect(nativeListener.removed).toBe(1)
    })

    it('survives StrictMode double-invocation with one live listener and a fresh read', async () => {
        platform.capacitor = true
        platform.current = 'android-native'
        render(
            <React.StrictMode>
                <ClientSupportGate enabled>
                    <Wallet />
                </ClientSupportGate>
            </React.StrictMode>
        )
        // StrictMode ran setup → cleanup → setup: the first read was retired
        // and a second started, so both park here.
        await fetches(2)
        await answer(new TypeError('retired'))
        expect(screen.queryByText("Couldn't check this version")).not.toBeInTheDocument()
        await answer(ZERO)
        expect(screen.getByTestId('wallet')).toBeInTheDocument()
    })
})
