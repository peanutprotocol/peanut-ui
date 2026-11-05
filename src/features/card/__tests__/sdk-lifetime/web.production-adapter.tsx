import React, { useState } from 'react'
import { act, fireEvent, render, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { IntlWrapper } from '@/test-utils/intl'
import { AuthContext } from '@/context/authContext'
import { KernelClientProvider } from '@/context/kernelClient.context'
import { LoadingStateContextProvider } from '@/context/loadingStates.context'
import { ModalsProvider } from '@/context/ModalsContext'
import { ToastProvider } from '@/components/0_Bruddle/Toast'
import { RainCooldownProvider } from '@/context/RainCooldownContext'
import { clearAuthToken, setAuthToken } from '@/utils/auth-token'
import { primeStepUpToken, clearStepUpToken } from '@/services/step-up'
import { rainApi } from '@/services/rain'
import { CardPage } from '../../CardPage'
import { issuedCardOverview } from '../addon-continuation/fixtures'
import type { Adapter, Callback, Delivery, Harness, Launch, Receipt } from './adapter-contract'

let mockNetwork: (path: string, init?: RequestInit) => Promise<Response>
jest.mock('@/utils/api-fetch', () => ({
    apiFetch: (path: string, init?: RequestInit) => mockNetwork(path, init),
    serverFetch: (path: string, init?: RequestInit) => mockNetwork(path, init),
}))
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
    usePathname: () => '/card', useSearchParams: () => new URLSearchParams(),
}))
jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())
jest.mock('@/constants/harness.consts', () => ({
    ...jest.requireActual('@/constants/harness.consts'), harnessPasskeyBypass: () => true,
}))

const response = (status: number, body: unknown): Response =>
    ({ status, ok: status >= 200 && status < 300, json: async () => body } as Response)
const jwt = (owner: string) => `x.${btoa(JSON.stringify({ userId: owner }))}.y`
type Captured = { refresh: () => Promise<string>; events: Record<string, (...args: never[]) => unknown>; throwOnDestroy: boolean }

export const webAdapter: Adapter = {
    platform: 'web',
    mount: async (initial): Promise<Harness> => {
        const originalFetch = global.fetch
        const originalWebSocket = global.WebSocket
        const originalSdk = window.snsWebSdk
        const receipts: Receipt[] = []
        global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            receipts.push({ kind: 'provider', method: init?.method ?? 'GET', path: String(input), body: init?.body })
            throw new Error('Unexpected external network request')
        }) as typeof fetch
        global.WebSocket = class { constructor() { throw new Error('Unexpected external WebSocket') } } as unknown as typeof WebSocket
        const launches: Launch[] = []
        const forbiddenCalls: unknown[] = []
        const captured = new Map<string, Captured>()
        let nextDeferred: { resolve?: (token: string) => void } | undefined
        let tokenNumber = 0
        let owner: string | null = initial.owner
        let overview = { ...issuedCardOverview(), pendingVerification: { kind: 'card_addon' as const, generation: initial.generation, entryScope: initial.scope } }
        let changeSession: (owner: string | null) => void = () => {}
        let routeVisible: (visible: boolean) => void = () => {}
        const query = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
        // Hydrate the same two public fixture responses the real queries read.
        // This only prepares I/O state; actual card and SDK decisions still render normally.
        query.setQueryData(['card-info', initial.owner], { isEligible: true })
        query.setQueryData(['rain-card-overview', initial.owner], overview)
        mockNetwork = async (path, init) => {
            const method = init?.method ?? 'GET'
            const url = String(path).split('?')[0]
            const body = init?.body ? JSON.parse(String(init.body)) : undefined
            const headers = new Headers(init?.headers)
            if (url === '/rain/verification/resume' && method === 'POST') {
                const identity = { owner: headers.get('x-kyc-entry-user')!, scope: headers.get('x-kyc-entry-scope')!, generation: body.generation }
                const item: Receipt = { kind: 'resume', method, path: url, body, identity }
                receipts.push(item)
                const held = nextDeferred
                nextDeferred = undefined
                if (held) return new Promise<Response>((resolve) => { held.resolve = (token) => { item.responseToken = token; resolve(response(200, { token })) } })
                const token = `synthetic-token-${++tokenNumber}`
                item.responseToken = token
                return response(200, { token })
            }
            const kind = method === 'POST' && url === '/rain/cards' ? 'apply' : 'other'
            receipts.push({ kind, method, path: url, body })
            if (url === '/rain/cards') return response(200, overview)
            if (url === '/users/me') return response(200, { user: { userId: owner }, accounts: [], rails: [], capabilities: { rails: [], nextActions: [], restrictions: [] } })
            if (url === '/card') return response(200, { isEligible: true })
            if (url === '/rain/cards/funding/access') return response(200, { fundingMode: 'legacy', enrollmentAllowed: false })
            if (url === '/rain/cards/funding') return response(200, { management: { status: 'ready', reason: null, migration: null, stop: null } })
            return response(200, {})
        }
        window.snsWebSdk = {
            init: (token: string, refresh: () => Promise<string>) => {
                const wire = receipts.findLast((r) => r.kind === 'resume' && r.responseToken === token)
                if (!wire?.identity) throw new Error('SDK token has no captured resume response')
                const launch: Launch = { id: `launch-${launches.length + 1}`, token, identity: wire.identity }
                const instance: Captured = { refresh, events: {}, throwOnDestroy: false }
                launches.push(launch)
                captured.set(launch.id, instance)
                const builder = {
                    withConf: () => builder,
                    withOptions: () => builder,
                    on: (name: string, callback: (...args: never[]) => unknown) => { instance.events[name] = callback; return builder },
                    build: () => ({ launch: () => {}, destroy: () => { if (instance.throwOnDestroy) throw new Error('synthetic teardown failure') } }),
                }
                return builder
            },
        } as unknown as typeof window.snsWebSdk
        const apply = jest.spyOn(rainApi, 'applyForCard')
        const actualApply = apply.getMockImplementation()
        apply.mockImplementation((...args) => { forbiddenCalls.push({ kind: 'apply', args }); return actualApply!(...args) })
        const Profile = ({ children }: { children: React.ReactNode }) => {
            const [current, setCurrent] = useState<string | null>(initial.owner)
            const [visible, setVisible] = useState(true)
            changeSession = setCurrent
            routeVisible = setVisible
            owner = current
            const user = current ? { user: { userId: current }, accounts: [], rails: [], capabilities: { rails: [], nextActions: [], restrictions: [] } } : null
            const fetchUser = async () => (await mockNetwork('/users/me', { method: 'GET' })).json()
            const logoutUser = async () => { await clearAuthToken(); setCurrent(null) }
            return <AuthContext.Provider value={{ user, fetchUser, logoutUser, isFetchingUser: false, invitedUsernamesSet: new Set() } as never}>{visible ? children : null}</AuthContext.Provider>
        }
        setAuthToken(jwt(initial.owner))
        primeStepUpToken('synthetic-step-up', 600)
        const view = render(<IntlWrapper><QueryClientProvider client={query}><ToastProvider><Profile><KernelClientProvider><LoadingStateContextProvider><ModalsProvider><RainCooldownProvider><NuqsTestingAdapter><CardPage /></NuqsTestingAdapter></RainCooldownProvider></ModalsProvider></LoadingStateContextProvider></KernelClientProvider></Profile></ToastProvider></QueryClientProvider></IntlWrapper>)
        const settle = async () => {
            await act(async () => {
                await Promise.resolve()
                await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
                await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
                await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
                await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
            })
            if (owner) await waitFor(() => {
                for (const key of ['card-info', 'rain-card-overview']) {
                    const state = query.getQueryState([key, owner])
                    if (!state || state.fetchStatus === 'fetching' || state.status === 'pending') throw new Error(`Waiting for ${key}`)
                }
            }, { timeout: 3000 })
        }
        const sdkRoot = () => document.querySelector<HTMLElement>('[data-testid="kyc-sumsub-sdk"]')
        const callbackFor = (launch: Launch, event: Callback): (() => unknown) => {
            const instance = captured.get(launch.id)
            if (!instance) throw new Error('Missing captured SDK launch')
            return event === 'refresh' ? instance.refresh : instance.events[event === 'submitted' ? 'onApplicantSubmitted' : 'onActionSubmitted']
        }
        const invoke = (callback: () => unknown): Promise<Delivery> => {
            let value: unknown
            try {
                act(() => { value = callback() })
                return Promise.resolve(value).then((result) => ({ status: 'fulfilled' as const, value: result }), (error) => ({ status: 'rejected' as const, value: error }))
            } catch (error) { return Promise.resolve({ status: 'rejected' as const, value: error }) }
        }
        const deliver = (launch: Launch, event: Callback): Promise<Delivery> => invoke(callbackFor(launch, event))
        await settle()
        return {
            receipts, launches, forbiddenCalls,
            visibleSdkRoot: sdkRoot,
            openThroughUi: async () => {
                const before = launches.length
                const button = within(view.container).getByText(/^complete verification$/i)
                await act(async () => { fireEvent.click(button) })
                await waitFor(() => { if (launches.length !== before + 1 || !sdkRoot()) throw new Error('Waiting for actual SDK launch') }, { timeout: 3000 })
                return launches[before]
            },
            deliver,
            queue: (launch, event) => { const callback = callbackFor(launch, event); return () => invoke(callback) },
            close: async () => {
                const root = sdkRoot()
                if (!root) throw new Error('SDK is not visible')
                const dialog = root.closest('[role="dialog"]') ?? root.parentElement?.parentElement?.parentElement
                if (!dialog) throw new Error('SDK dialog unavailable')
                await act(async () => { fireEvent.click(within(dialog as HTMLElement).getAllByRole('button', { name: /^close$/i })[0]) })
                await waitFor(() => within(document.body).getByRole('button', { name: /^exit$/i }))
                await act(async () => { fireEvent.click(within(document.body).getByRole('button', { name: /^exit$/i })) })
                await settle()
            },
            throwOnTeardown: (launch) => { captured.get(launch.id)!.throwOnDestroy = true },
            setAuth: async (next) => {
                if (!next) await clearAuthToken(); else setAuthToken(jwt(next))
                await act(async () => { changeSession(next) })
            },
            publishPending: async (identity) => {
                overview = { ...issuedCardOverview(), pendingVerification: { kind: 'card_addon', generation: identity.generation, entryScope: identity.scope } }
                await act(async () => { await query.invalidateQueries({ queryKey: ['rain-card-overview'] }) })
            },
            leaveRoute: async () => { await act(async () => { routeVisible(false) }) },
            returnToRoute: async () => { await act(async () => { routeVisible(true) }); await settle() },
            deferNextResume: () => {
                const held: { resolve?: (token: string) => void } = {}
                nextDeferred = held
                return { resolveToken: async (token) => { if (!held.resolve) throw new Error('No deferred resume'); held.resolve(token); await act(async () => { await Promise.resolve() }) } }
            },
            settle,
            dispose: async () => {
                view.unmount(); query.clear(); apply.mockRestore(); clearStepUpToken(); window.snsWebSdk = originalSdk
                global.fetch = originalFetch; global.WebSocket = originalWebSocket
            },
        }
    },
}
