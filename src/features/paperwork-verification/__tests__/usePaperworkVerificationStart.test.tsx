/**
 * APK #4: Home's Verify opened the legacy start modal whenever the plan read
 * failed, and its Verify opened a legacy applicant for a Smart Paperwork
 * Verification user. An unreadable plan now goes to /verify, which retries.
 */
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { serverFetch } from '@/utils/api-fetch'
import { usePaperworkVerificationStart } from '../usePaperworkVerificationStart'

jest.mock('@/utils/api-fetch', () => ({ serverFetch: jest.fn() }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/hooks/useKycDegraded', () => ({ useKycDegraded: () => false }))
jest.mock('@/hooks/useIdentityVerification', () => ({ useIdentityVerification: () => ({ isRegionRestricted: false }) }))

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as unknown as Response
const status = (code: number) => ({ ok: false, status: code, json: async () => ({}) }) as unknown as Response

const start = async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
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

it('a plan that cannot be read opens /verify; only a plan that says so keeps the start modal', async () => {
    jest.mocked(serverFetch).mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(start()).resolves.toBe(true)

    // the server keeps the user on today's flow
    jest.mocked(serverFetch).mockResolvedValue(ok({ available: false, routes: [], flow: 'document-first' }))
    await expect(start()).resolves.toBe(false)

    // an API with no plan route
    jest.mocked(serverFetch).mockResolvedValue(status(404))
    await expect(start()).resolves.toBe(false)
})
