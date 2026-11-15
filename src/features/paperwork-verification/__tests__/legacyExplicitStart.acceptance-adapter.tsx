import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { IntlWrapper } from '@/test-utils/intl'
import { SumsubKycFlow } from '@/components/Kyc/SumsubKycFlow'
import { AddFeatureFlow } from '../AddFeatureFlow'

type Request = { method: string; url: string; headers: Record<string, string>; body: unknown; accountId: string }
type SdkProps = { visible: boolean; accessToken: string | null; onRefreshToken: () => Promise<string> }
let mockUserId = 'user-a'
let mockRequest: (request: Request) => Promise<{ status: number; body: unknown }>
let mockSdkProps: SdkProps | null = null

jest.mock('@/utils/capacitor', () => ({ ...jest.requireActual('@/utils/capacitor'), isCapacitor: () => true }))
jest.mock('@/utils/native-platform', () => ({
    ...require('@/test-utils/native-platform-mock').createNativePlatformMock(),
    useNativePlatform: () => ({ isHydrated: true, isCapacitor: true }),
}))
jest.mock('@/utils/auth-token', () => ({
    ...jest.requireActual('@/utils/auth-token'),
    getAuthToken: () => null,
    authReady: async () => {},
    getAuthHeaders: (headers: Record<string, string>) => headers,
}))
jest.mock('@/utils/sentry.utils', () => ({
    ...jest.requireActual('@/utils/sentry.utils'),
    fetchWithSentry: async (url: string, options: RequestInit) => {
        const path = new URL(url).pathname
        const result =
            path === '/users/kyc/plan'
                ? { status: 200, body: { available: false, routes: [] } }
                : await mockRequest({
                      method: options.method ?? 'GET',
                      url: path,
                      headers: Object.fromEntries(new Headers(options.headers).entries()),
                      body: options.body ? JSON.parse(String(options.body)) : undefined,
                      accountId: mockUserId,
                  })
        return {
            status: result.status,
            ok: result.status >= 200 && result.status < 300,
            json: async () => result.body,
        } as Response
    },
}))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({
        user: {
            user: { userId: mockUserId },
            accounts: [],
            capabilities: { rails: [], nextActions: [], restrictions: [] },
        },
        fetchUser: jest.fn(),
    }),
    useOptionalAuth: () => ({ user: { user: { userId: mockUserId } } }),
}))
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
}))
jest.mock('@/components/Kyc/SumsubNativeSdk', () => ({
    SumsubNativeSdk: (props: SdkProps) => {
        mockSdkProps = props
        return props.visible ? <div data-testid="external-sdk" /> : null
    },
}))
jest.mock('@/components/Kyc/SumsubWebSdkModal', () => ({ SumsubWebSdkModal: () => null }))
jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => ({ error: jest.fn() }) }))
jest.mock('@/context/ModalsContext', () => ({ useModalsContext: () => ({ setIsSupportModalOpen: jest.fn() }) }))

export function createLegacySdkHarness({ request }: { request: typeof mockRequest; sessionMode: 'cookie-only' }) {
    mockRequest = request
    mockSdkProps = null
    const query = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrap = (feature = false) => (
        <IntlWrapper>
            <QueryClientProvider client={query}>
                <NuqsTestingAdapter>
                    {feature ? <AddFeatureFlow feature="card" onExit={() => {}} /> : <SumsubKycFlow />}
                </NuqsTestingAdapter>
            </QueryClientProvider>
        </IntlWrapper>
    )
    const view = render(wrap())
    const flush = async () => {
        await act(async () => {
            await Promise.resolve()
            await Promise.resolve()
        })
    }
    return {
        enter: async ({ userId }: { userId: string }) => {
            mockUserId = userId
            await act(async () => {
                fireEvent.click(screen.getByRole('button', { name: /start verification/i }))
            })
        },
        rerender: async () => {
            await act(async () => view.rerender(wrap()))
        },
        refresh: async () => {
            if (!mockSdkProps?.visible) throw new Error('SDK not open')
            return mockSdkProps.onRefreshToken()
        },
        mountFeatureQuestions: async () => {
            await act(async () => view.rerender(wrap(true)))
        },
        flush,
        usable: () =>
            !!view.container.querySelector('[data-testid="external-sdk"]') ||
            !!screen.queryByRole('button', { name: /start verification/i }),
        dispose: async () => {
            view.unmount()
            query.clear()
            mockSdkProps = null
        },
    }
}
