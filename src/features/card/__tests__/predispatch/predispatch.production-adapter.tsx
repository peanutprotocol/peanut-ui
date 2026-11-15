import React from 'react'
import Cookies from 'js-cookie'
import { act, render, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { IntlWrapper } from '@/test-utils/intl'
import { AuthProvider } from '@/context/authContext'
import { KernelClientProvider } from '@/context/kernelClient.context'
import { LoadingStateContextProvider } from '@/context/loadingStates.context'
import { ModalsProvider } from '@/context/ModalsContext'
import { ToastProvider } from '@/components/0_Bruddle/Toast'
import { RainCooldownProvider } from '@/context/RainCooldownContext'
import { clearAuthToken, setAuthToken, getAuthToken, getClearEpoch } from '@/utils/auth-token'
import { primeStepUpToken, clearStepUpToken } from '@/services/step-up'
import { USER } from '@/constants/query.consts'
import { CardPage } from '../../CardPage'
import { recordVerificationOpened } from '@/features/paperwork-verification/useVerificationOpening'
import type { PredispatchAdapter } from './predispatch-adapter-contract'

function deferred<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void
    const promise = new Promise<T>((r) => {
        resolve = r
    })
    return { promise, resolve }
}
// Module initialization reads the mocked platform before this fixture finishes loading.
var mockNative = false
var mockClearing = false
let mockStorage = new Map<string, string>()
let mockCookieClear: ReturnType<typeof deferred<void>> | undefined
let mockCookieEntered: ReturnType<typeof deferred<void>> | undefined
let mockReady: ReturnType<typeof deferred<void>> | undefined
let mockReadyEntered: ReturnType<typeof deferred<void>> | undefined
let mockCookieAuthenticated = false
let mockDispatch: (url: string, options?: RequestInit, native?: boolean) => Promise<Response>
let mockProviderOperations = 0

jest.mock('@/utils/capacitor', () => ({
    ...jest.requireActual('@/utils/capacitor'),
    isCapacitor: () => mockNative || mockClearing,
    isNativeBridge: () => mockNative || mockClearing,
    isAndroidNative: () => mockNative || mockClearing,
    isAndroidNativeBridge: () => mockNative || mockClearing,
    isIOSNative: () => false,
    getPlatform: () => (mockNative || mockClearing ? 'android-native' : 'web'),
}))
jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())
jest.mock('@/utils/auth-token', () => {
    const actual = jest.requireActual('@/utils/auth-token')
    return {
        ...actual,
        authReady: async () => {
            await actual.authReady()
            const gate = mockReady
            if (gate) {
                mockReadyEntered?.resolve()
                await gate.promise
            }
        },
    }
})
jest.mock('@capacitor/preferences', () => ({
    Preferences: {
        get: async ({ key }: { key: string }) => ({ value: mockStorage.get(key) ?? null }),
        set: async ({ key, value }: { key: string; value: string }) => {
            mockStorage.set(key, value)
        },
        remove: async ({ key }: { key: string }) => {
            mockStorage.delete(key)
        },
    },
}))
jest.mock('@capacitor/core', () => ({
    ...jest.requireActual('@capacitor/core'),
    CapacitorCookies: {
        // Android cannot expose the API cookie to JavaScript.
        getCookies: async () => ({}),
        clearCookies: async () => {
            mockCookieEntered?.resolve()
            if (mockCookieClear) await mockCookieClear.promise
            mockCookieAuthenticated = false
        },
    },
    CapacitorHttp: {
        request: async (options: { url: string; method: string; headers: Record<string, string>; data?: string }) => {
            const response = await mockDispatch(
                options.url,
                { method: options.method, headers: options.headers, body: options.data },
                true
            )
            return {
                status: response.status,
                data: await response.text(),
                headers: Object.fromEntries(response.headers.entries()),
            }
        },
    },
}))
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
    usePathname: () => '/card',
    useSearchParams: () => new URLSearchParams(),
}))
jest.mock('@/constants/harness.consts', () => ({
    ...jest.requireActual('@/constants/harness.consts'),
    harnessPasskeyBypass: () => true,
}))
jest.mock('@/components/Kyc/SumsubWebSdkModal', () => ({
    SumsubWebSdkModal: (props: { visible: boolean }) => {
        if (props.visible) mockProviderOperations++
        return null
    },
}))
jest.mock('@/components/Kyc/SumsubNativeSdk', () => ({
    SumsubNativeSdk: (props: { visible: boolean }) => {
        if (props.visible) mockProviderOperations++
        return null
    },
}))

export const predispatchAdapter: PredispatchAdapter = {
    mount: async ({ session, transport, account, scope, generation }) => {
        const originalFetch = global.fetch
        const originalWebSocket = global.WebSocket
        mockNative = transport === 'native'
        mockClearing = false
        mockReady = undefined
        mockCookieClear = undefined
        mockCookieEntered = undefined
        mockStorage = new Map()
        mockProviderOperations = 0
        const receipts: Array<{ path: string; boundary: 'web' | 'native'; headers: Headers }> = []
        const pending: Array<ReturnType<typeof deferred<Response>>> = []
        const opening = new AbortController()
        const openingOutcomes: Array<Promise<void>> = []
        const unexpectedErrors: unknown[] = []
        let owner = account as string
        let actionScope = scope
        let actionGeneration = generation as string
        const profile = () => ({
            user: { userId: owner, username: 'synthetic-user' },
            accounts: [],
            rails: [],
            capabilities: { rails: [], nextActions: [], restrictions: [] },
        })
        const overview = () => ({
            status: { hasApplication: true, railStatus: 'ENABLED' },
            balance: null,
            balanceUnavailable: false,
            cards: [
                {
                    id: 'card-a',
                    rainCardId: 'rain-a',
                    last4: '1234',
                    expiryMonth: 12,
                    expiryYear: 2030,
                    status: 'ACTIVE',
                    network: 'VISA',
                    issuedAt: '2026-01-01T00:00:00Z',
                    hasWithdrawApproval: false,
                    hasStoredWithdrawApproval: false,
                },
            ],
            pendingVerification: { kind: 'card_addon', generation: actionGeneration, entryScope: actionScope },
        })
        const respond = (body: unknown) =>
            new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
        mockDispatch = async (url, init, native = false) => {
            const path = new URL(url, 'https://synthetic.invalid').pathname
            const method = (init?.method ?? 'GET').toUpperCase()
            const headers = new Headers(init?.headers)
            receipts.push({ path, boundary: native ? 'native' : 'web', headers })
            if (method === 'POST' && (path === '/rain/verification/resume' || path === '/users/kyc/opened')) {
                const hold = deferred<Response>()
                pending.push(hold)
                return hold.promise
            }
            if (path === '/users/me') {
                if (!headers.has('authorization') && !mockCookieAuthenticated)
                    return new Response('{}', { status: 401 })
                return respond(profile())
            }
            if (path === '/rain/cards') return respond(overview())
            if (path === '/card') return respond({ isEligible: true })
            if (path === '/rain/cards/funding/access')
                return respond({ fundingMode: 'legacy', enrollmentAllowed: false })
            if (path === '/rain/cards/funding')
                return respond({ management: { status: 'ready', reason: null, migration: null, stop: null } })
            if (/\/rain\/cards\/[^/]+\/details/.test(path))
                return respond({
                    pan: '4000000000001234',
                    cvv: '123',
                    expiryMonth: 12,
                    expiryYear: 2030,
                    last4: '1234',
                    network: 'VISA',
                })
            return respond({})
        }
        global.fetch = (async (url: string | URL | Request, init?: RequestInit) =>
            mockDispatch(String(url), init)) as typeof fetch
        global.WebSocket = class {
            constructor() {
                throw new Error('Unexpected external WebSocket')
            }
        } as unknown as typeof WebSocket
        const token = (id: string) => `x.${btoa(JSON.stringify({ userId: id }))}.y`
        await clearAuthToken()
        mockCookieAuthenticated = session === 'cookie-only'
        // A retained web page can outlive its readable cookie while the
        // browser still holds an authenticated API-domain HttpOnly cookie.
        // Cold web cookie-only card mounting is not supported by cardApi.
        if (session === 'token' || transport === 'web') setAuthToken(token(account))
        else if (getAuthToken() !== null) throw new Error('Cookie-only fixture has a bearer token')
        primeStepUpToken('synthetic-step-up', 600)
        const query = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
        const view = render(
            <IntlWrapper>
                <QueryClientProvider client={query}>
                    <ToastProvider>
                        <AuthProvider>
                            <KernelClientProvider>
                                <LoadingStateContextProvider>
                                    <ModalsProvider>
                                        <RainCooldownProvider>
                                            <NuqsTestingAdapter>
                                                <CardPage />
                                            </NuqsTestingAdapter>
                                        </RainCooldownProvider>
                                    </ModalsProvider>
                                </LoadingStateContextProvider>
                            </KernelClientProvider>
                        </AuthProvider>
                    </ToastProvider>
                </QueryClientProvider>
            </IntlWrapper>
        )
        const flush = async () => {
            await act(async () => {
                await Promise.resolve()
                await Promise.resolve()
            })
            if (unexpectedErrors.length) throw unexpectedErrors[0]
        }
        try {
            await waitFor(
                () => {
                    if (!within(view.container).queryByText(/^complete verification$/i))
                        throw new Error('Waiting for actual card CTA')
                },
                { timeout: 3000 }
            )
        } catch (error) {
            view.unmount()
            query.clear()
            clearStepUpToken()
            await clearAuthToken()
            global.fetch = originalFetch
            global.WebSocket = originalWebSocket
            throw error
        }
        await flush()
        if (session === 'cookie-only' && transport === 'web') {
            Cookies.remove('jwt-token', { path: '/' })
            if (getAuthToken() !== null || !mockCookieAuthenticated)
                throw new Error('Retained cookie-only fixture did not lose only its readable credential')
        }
        const cta = within(view.container).getByText(/^complete verification$/i)
        const reactPropsKey = Object.keys(cta).find((key) => key.startsWith('__reactProps$'))
        if (!reactPropsKey) throw new Error('Real CTA has no installed React handler')
        const installedProps = (cta as unknown as Record<string, { onClick?: unknown }>)[reactPropsKey]
        if (typeof installedProps.onClick !== 'function') throw new Error('Actual CTA has no click handler')
        let clearOperation: Promise<void> | undefined
        let clearWasPending = false
        return {
            beginAuthClearHoldingCookieClear: async () => {
                mockCookieClear = deferred<void>()
                mockCookieEntered = deferred<void>()
                const before = getClearEpoch()
                // Only the clear action selects the async native cookie branch;
                // transport selection is restored before the retained event.
                mockClearing = true
                clearWasPending = true
                clearOperation = clearAuthToken().then(() => {
                    clearWasPending = false
                })
                await mockCookieEntered.promise
                mockClearing = false
                if (getClearEpoch() !== before + 1 || !clearWasPending)
                    throw new Error('No real invalidation with cookie clearing pending')
            },
            releaseCookieClear: async () => {
                mockCookieClear?.resolve()
                await clearOperation
            },
            tapRenderedCardCta: async () => {
                if (
                    !document.contains(cta) ||
                    (cta as unknown as Record<string, unknown>)[reactPropsKey] !== installedProps
                )
                    throw new Error('CTA handler replaced before tap')
                // No act, rerender or scheduler drainage before the real DOM event.
                cta.dispatchEvent(new MouseEvent('click', { bubbles: true }))
            },
            holdAuthReadiness: async () => {
                mockReady = deferred<void>()
                mockReadyEntered = deferred<void>()
            },
            enterPaperworkAndWaitUntilParked: async () => {
                if (!mockReady || !mockReadyEntered) throw new Error('Readiness was not armed')
                openingOutcomes.push(
                    recordVerificationOpened(account, scope, opening.signal).catch((error: unknown) => {
                        if (
                            !(
                                typeof error === 'object' &&
                                error !== null &&
                                'name' in error &&
                                error.name === 'AbortError'
                            )
                        )
                            unexpectedErrors.push(error)
                    })
                )
                await mockReadyEntered.promise
            },
            releaseAuthReadiness: async () => {
                const gate = mockReady
                mockReady = undefined
                gate?.resolve()
            },
            changeToAccountB: async () => {
                // Production logout invalidation happens before the next
                // external cookie/login state and account-store publication.
                await clearAuthToken()
                owner = 'synthetic-owner-b'
                actionScope = 'b'.repeat(64)
                actionGeneration = 'generation-b'
                if (session === 'token') setAuthToken(token(owner))
                else mockCookieAuthenticated = true
                await act(async () => {
                    query.setQueryData([USER], profile())
                    query.setQueryData(['rain-card-overview', owner], overview())
                })
            },
            flush,
            observations: () => ({
                resumeRequests: receipts.filter((r) => r.path === '/rain/verification/resume').length,
                openingDispatches: receipts.filter((r) => r.path === '/users/kyc/opened').length,
                providerOperations: mockProviderOperations,
            }),
            dispose: async () => {
                opening.abort()
                mockReady?.resolve()
                mockReady = undefined
                mockCookieClear?.resolve()
                await clearOperation
                for (const hold of pending) hold.resolve(respond({ token: 'synthetic-sdk-token' }))
                await Promise.all(openingOutcomes)
                view.unmount()
                query.clear()
                clearStepUpToken()
                await clearAuthToken()
                global.fetch = originalFetch
                global.WebSocket = originalWebSocket
                mockCookieAuthenticated = false
                if (
                    session === 'cookie-only' &&
                    receipts.some(
                        (receipt) =>
                            (receipt.path === '/rain/verification/resume' || receipt.path === '/users/kyc/opened') &&
                            receipt.headers.has('authorization')
                    )
                )
                    throw new Error('Named cookie-only operation carried a bearer token')
                if (unexpectedErrors.length) throw unexpectedErrors[0]
            },
        }
    },
}
