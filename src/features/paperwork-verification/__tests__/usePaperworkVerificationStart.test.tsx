import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { serverFetch } from '@/utils/api-fetch'
import { PAPERWORK_VERIFICATION_PLAN_QUERY_KEY, usePaperworkVerificationStart } from '../usePaperworkVerificationStart'

let mockUserId: string | undefined = 'user-a'
jest.mock('@/context/authContext', () => ({ useOptionalAuth: () => ({ user: { user: { userId: mockUserId } } }) }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ prefetch: jest.fn() }) }))
jest.mock('@/utils/api-fetch', () => ({ serverFetch: jest.fn() }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/hooks/useKycDegraded', () => ({ useKycDegraded: () => false }))
jest.mock('@/hooks/useIdentityVerification', () => ({ useIdentityVerification: () => ({ isRegionRestricted: false }) }))

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as unknown as Response
const status = (code: number) => ({ ok: false, status: code, json: async () => ({}) }) as unknown as Response

const start = async (client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) => {
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => usePaperworkVerificationStart(), { wrapper })
    let opensVerify: string | null | undefined
    await act(async () => {
        const tap = result.current()
        await jest.runAllTimersAsync()
        opensVerify = await tap
    })
    return opensVerify
}

beforeEach(() => {
    mockUserId = 'user-a'
    jest.useFakeTimers()
    jest.mocked(serverFetch).mockReset()
})
afterEach(() => jest.useRealTimers())

it('new and unknown identities open /verify while legacy keeps the start modal', async () => {
    jest.mocked(serverFetch).mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(start()).resolves.toBe('/verify')

    jest.mocked(serverFetch).mockResolvedValue(ok({ available: true, routes: [], flow: 'verify-once', needs: [] }))
    await expect(start()).resolves.toBe('/verify')

    // the server keeps the user on today's flow
    jest.mocked(serverFetch).mockResolvedValue(ok({ available: false, routes: [], flow: null }))
    await expect(start()).resolves.toBeNull()

    jest.mocked(serverFetch).mockResolvedValue(
        ok({ available: false, routes: [], flow: null, unavailableReason: 'residence_not_supported' })
    )
    await expect(start()).resolves.toBe('/verify?reason=residence_not_supported')

    // an API with no plan route
    jest.mocked(serverFetch).mockResolvedValue(status(404))
    await expect(start()).resolves.toBe('/verify')
})

// Slava, 2026-10-25: the Verify tap waited on a plan read Home had already made.
it('a tap decides from the plan Home read, without waiting for the network', async () => {
    jest.mocked(serverFetch).mockReturnValue(new Promise(() => {}))
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    client.setQueryData([...PAPERWORK_VERIFICATION_PLAN_QUERY_KEY, 'user-a'], {
        flow: 'verify-once',
        needs: [],
        routes: [],
    })

    await expect(start(client)).resolves.toBe('/verify')
})

it('never reuses A’s cached plan for B while B’s plan remains unreadable', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    client.setQueryData([...PAPERWORK_VERIFICATION_PLAN_QUERY_KEY, 'user-a'], {
        flow: 'verify-once',
        needs: [],
        routes: [],
    })
    mockUserId = 'user-b'
    jest.mocked(serverFetch).mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(start(client)).resolves.toBe('/verify')
    client.clear()
})

it('does not use an old unscoped plan entry for an authenticated account', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    client.setQueryData(PAPERWORK_VERIFICATION_PLAN_QUERY_KEY, { flow: 'verify-once', needs: [], routes: [] })
    jest.mocked(serverFetch).mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(start(client)).resolves.toBe('/verify')
    client.clear()
})
