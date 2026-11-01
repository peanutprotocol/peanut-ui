/**
 * APK #4: Home's Verify opened the legacy start modal whenever the plan read
 * failed, and its Verify opened a legacy applicant for a Smart Paperwork
 * Verification user. The API now refuses that start (409
 * paperwork_verification_required, which opens /verify), so an unreadable plan
 * keeps the start modal instead of stranding legacy users on a retry screen.
 */
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { serverFetch } from '@/utils/api-fetch'
import { PAPERWORK_VERIFICATION_PLAN_QUERY_KEY, usePaperworkVerificationStart } from '../usePaperworkVerificationStart'

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
    let opensVerify: boolean | undefined
    await act(async () => {
        const tap = result.current()
        await jest.runAllTimersAsync()
        opensVerify = await tap
    })
    return opensVerify
}

beforeEach(() => {
    jest.useFakeTimers()
    jest.mocked(serverFetch).mockReset()
})
afterEach(() => jest.useRealTimers())

it('only a plan that says so opens /verify; an unreadable one keeps the start modal', async () => {
    jest.mocked(serverFetch).mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(start()).resolves.toBe(false)

    jest.mocked(serverFetch).mockResolvedValue(ok({ available: true, routes: [], flow: 'verify-once', needs: [] }))
    await expect(start()).resolves.toBe(true)

    // the server keeps the user on today's flow
    jest.mocked(serverFetch).mockResolvedValue(ok({ available: false, routes: [], flow: null }))
    await expect(start()).resolves.toBe(false)

    // an API with no plan route
    jest.mocked(serverFetch).mockResolvedValue(status(404))
    await expect(start()).resolves.toBe(false)
})

// Slava, 2026-10-25: the Verify tap waited on a plan read Home had already made.
it('a tap decides from the plan Home read, without waiting for the network', async () => {
    jest.mocked(serverFetch).mockReturnValue(new Promise(() => {}))
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    client.setQueryData(PAPERWORK_VERIFICATION_PLAN_QUERY_KEY, { flow: 'verify-once', needs: [], routes: [] })

    await expect(start(client)).resolves.toBe(true)
})
