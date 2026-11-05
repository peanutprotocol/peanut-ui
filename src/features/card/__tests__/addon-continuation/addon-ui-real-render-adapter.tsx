import React, { useEffect, useRef, useState } from 'react'
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
import type {
    AuthFixture,
    CardOverviewFixture,
    MountOptions,
    MountedCardContinuation,
    RecordedRequest,
    SdkSession,
} from './adapter-contract'

let mockNetwork: (path: string, init?: RequestInit) => Promise<Response>
let mockSdk: { mount: (props: SdkProps) => () => void } | undefined
type SdkProps = {
    visible: boolean
    accessToken: string | null
    onClose: () => void
    onComplete: () => void
    onRefreshToken: () => Promise<string>
}

jest.mock('@/utils/api-fetch', () => ({
    apiFetch: (path: string, init?: RequestInit) => mockNetwork(path, init),
    serverFetch: (path: string, init?: RequestInit) => mockNetwork(path, init),
}))
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
    usePathname: () => '/card',
    useSearchParams: () => new URLSearchParams(),
}))
jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())
jest.mock('@/constants/harness.consts', () => ({
    ...jest.requireActual('@/constants/harness.consts'),
    harnessPasskeyBypass: () => true,
}))
jest.mock('@/components/Kyc/SumsubWebSdkModal', () => ({
    SumsubWebSdkModal: (props: SdkProps) => {
        const current = useRef(props)
        current.current = props
        useEffect(() => {
            const initial = current.current
            return initial.visible && initial.accessToken
                ? mockSdk?.mount({
                      ...initial,
                      onClose: () => current.current.onClose(),
                      onComplete: () => current.current.onComplete(),
                      onRefreshToken: () => current.current.onRefreshToken(),
                  })
                : undefined
        }, [props.visible])
        return props.visible ? <div data-testid="external-sdk" /> : null
    },
}))
jest.mock('@/components/Kyc/SumsubNativeSdk', () => ({ SumsubNativeSdk: () => null }))

function response(status: number, body: unknown): Response {
    return { status, ok: status >= 200 && status < 300, json: async () => body } as Response
}

export const mountCardContinuation = async ({
    session: initialSession,
    overview: initialOverview,
}: MountOptions): Promise<MountedCardContinuation & { setOverviewResponse: (overview: CardOverviewFixture) => void }> => {
    const originalFetch = global.fetch
    const originalWebSocket = global.WebSocket
    global.fetch = jest.fn(async () => {
        throw new Error('Unexpected external network request')
    }) as typeof fetch
    global.WebSocket = class {
        constructor() {
            throw new Error('Unexpected external WebSocket')
        }
    } as unknown as typeof WebSocket
    const requests: RecordedRequest[] = []
    const forbiddenCalls: Array<{ kind: 'apply' | 'create-card' | 'issuance'; args: unknown[] }> = []
    const sessions: SdkSession[] = []
    const callbacks = new Map<string, SdkProps>()
    const queue: Array<{ resolve: (r: Response) => void; reject: (e: Error) => void }> = []
    let overview: CardOverviewFixture = initialOverview
    let setSessionValue: (value: AuthFixture) => void = () => {}
    const query = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    let currentSession = initialSession
    const classify = (method: string, path: string): RecordedRequest['kind'] => {
        if (method === 'GET' && path === '/rain/cards') return 'overview'
        if (method === 'GET' && path === '/users/me') return 'profile'
        if (method === 'POST' && path === '/rain/verification/resume') return 'resume'
        if (method === 'POST' && path === '/rain/cards') return 'apply'
        return 'other'
    }
    mockNetwork = async (path, init) => {
        const method = init?.method ?? 'GET'
        const signal = init?.signal ?? undefined
        const item: RecordedRequest = {
            method,
            path: String(path).split('?')[0],
            body: init?.body ? JSON.parse(String(init.body)) : undefined,
            headers: Object.fromEntries(new Headers(init?.headers).entries()),
            kind: classify(method, String(path).split('?')[0]),
            signalSupplied: !!signal,
            aborted: !!signal?.aborted,
        }
        signal?.addEventListener(
            'abort',
            () => {
                item.aborted = true
            },
            { once: true }
        )
        requests.push(item)
        if (item.kind === 'resume') return new Promise<Response>((resolve, reject) => queue.push({ resolve, reject }))
        if (item.kind === 'overview') return response(200, overview)
        if (item.kind === 'profile')
            return response(200, {
                user: { userId: currentSession?.userId },
                accounts: [],
                rails: [],
                capabilities: { rails: [], nextActions: [], restrictions: [] },
            })
        if (item.path === '/card') return response(200, { isEligible: true })
        if (item.path === '/rain/cards/funding/access')
            return response(200, { fundingMode: 'legacy', enrollmentAllowed: false })
        if (item.path === '/rain/cards/funding')
            return response(200, {
                management: { status: 'ready', reason: null, migration: null, stop: null },
            })
        if (/\/rain\/cards\/[^/]+\/details/.test(item.path))
            return response(200, {
                pan: '4000000000001234',
                cvv: '123',
                expiryMonth: 12,
                expiryYear: 2030,
                last4: '1234',
                network: 'VISA',
            })
        return response(200, {})
    }
    mockSdk = {
        mount: (props) => {
            const id = String(sessions.length + 1)
            const record = { id, token: props.accessToken!, mounted: true }
            sessions.push(record)
            callbacks.set(id, props)
            return () => {
                record.mounted = false
            }
        },
    }
    const apply = jest.spyOn(rainApi, 'applyForCard')
    const realApply = apply.getMockImplementation()
    apply.mockImplementation((...args) => {
        forbiddenCalls.push({ kind: 'apply', args })
        return realApply!(...args)
    })
    const Profile = ({ children }: { children: React.ReactNode }) => {
        const [session, setSession] = useState(initialSession)
        setSessionValue = setSession
        currentSession = session
        const user = session?.userId
            ? {
                  user: { userId: session.userId },
                  accounts: [],
                  rails: [],
                  capabilities: { rails: [], nextActions: [], restrictions: [] },
              }
            : null
        const fetchUser = async () => {
            const r = await mockNetwork('/users/me', { method: 'GET' })
            return r.json()
        }
        const logoutUser = async () => {
            await clearAuthToken()
            setSession(null)
        }
        return (
            <AuthContext.Provider
                value={{ user, fetchUser, logoutUser, isFetchingUser: false, invitedUsernamesSet: new Set() } as never}
            >
                {children}
            </AuthContext.Provider>
        )
    }
    if (initialSession?.userId) setAuthToken(`x.${btoa(JSON.stringify({ userId: initialSession.userId }))}.y`)
    primeStepUpToken('synthetic-step-up', 600)
    let view: ReturnType<typeof render>
    try {
        view = render(
            <IntlWrapper>
                <QueryClientProvider client={query}>
                    <ToastProvider>
                        <Profile>
                            <KernelClientProvider>
                                <LoadingStateContextProvider>
                                    <ModalsProvider>
                                        <RainCooldownProvider>
                                            <NuqsTestingAdapter><CardPage /></NuqsTestingAdapter>
                                        </RainCooldownProvider>
                                    </ModalsProvider>
                                </LoadingStateContextProvider>
                            </KernelClientProvider>
                        </Profile>
                    </ToastProvider>
                </QueryClientProvider>
            </IntlWrapper>
        )
    } catch (error) {
        query.clear()
        apply.mockRestore()
        clearStepUpToken()
        mockSdk = undefined
        global.fetch = originalFetch
        global.WebSocket = originalWebSocket
        throw error
    }
    const settle = async () => {
        await act(async () => {
            await Promise.resolve()
            await Promise.resolve()
        })
        if (currentSession?.userId) {
            await waitFor(() => {
                for (const key of ['card-info', 'rain-card-overview']) {
                    const state = query.getQueryState([key, currentSession?.userId])
                    if (!state || state.fetchStatus === 'fetching' || state.status === 'pending')
                        throw new Error(`Waiting for ${key}`)
                }
            }, { timeout: 3000 })
        }
    }
    return {
        root: view.container,
        requests,
        forbiddenCalls,
        sdk: {
            sessions,
            refresh: (id) => callbacks.get(id)!.onRefreshToken(),
            complete: async (id) => {
                await act(async () => callbacks.get(id)!.onComplete())
            },
            close: async (id) => {
                await act(async () => callbacks.get(id)!.onClose())
            },
        },
        deferNextResume: () => ({
            reply: async (status, body) => {
                const pending = queue.shift()
                if (!pending) throw new Error('No resume request')
                pending.resolve(response(status, body))
                await settle()
            },
            reject: async (error) => {
                const pending = queue.shift()
                if (!pending) throw new Error('No resume request')
                pending.reject(error)
                await settle()
            },
        }),
        tap: async (element) => {
            await act(async () => {
                fireEvent.click(element)
            })
        },
        setSession: async (session) => {
            if (session?.userId) setAuthToken(`x.${btoa(JSON.stringify({ userId: session.userId }))}.y`)
            await act(async () => setSessionValue(session))
        },
        setOverviewResponse: (next) => {
            overview = next
        },
        publishOverview: async (next) => {
            overview = next
            await act(async () => {
                await query.invalidateQueries({ queryKey: ['rain-card-overview'] })
            })
        },
        navigateAway: async () => {
            view.unmount()
        },
        settle,
        existingCardControl: () => within(view.container).getByRole('button', { name: /show card details/i }),
        existingCardManagementView: () => within(view.container).queryByRole('button', { name: /hide card details/i }),
        dispose: async () => {
            view.unmount()
            query.clear()
            apply.mockRestore()
            clearStepUpToken()
            mockSdk = undefined
            global.fetch = originalFetch
            global.WebSocket = originalWebSocket
        },
    }
}
