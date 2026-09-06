/**
 * claimLinkMutation.onError must not report an already-claimed 409 to Sentry:
 * it is the expected race the cancel surfaces now handle (TASK-22091), and it
 * was the whole of PEANUT-UI-SWF. Drives the real hook so the mutation's own
 * onError runs — the view tests mock useClaimLink and cannot see this.
 */
import React from 'react'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mockCaptureException = jest.fn()
jest.mock('@sentry/nextjs', () => ({ captureException: mockCaptureException }))
jest.mock('next/navigation', () => ({
    usePathname: () => '/claim',
    useSearchParams: () => new URLSearchParams(),
}))
jest.mock('@/context/loadingStates.context', () => {
    const ReactActual = jest.requireActual('react')
    return {
        loadingStateContext: ReactActual.createContext({
            loadingState: 'Idle',
            setLoadingState: jest.fn(),
            isLoading: false,
        }),
    }
})
jest.mock('@/utils/peanut-link.utils', () => ({
    generateKeysFromString: () => ({ address: '0xdead', privateKey: '0xbeef' }),
    getParamsFromLink: () => ({ password: 'pw', chainId: '42161', contractVersion: 'v4.4', depositIdx: 1 }),
}))
jest.mock('@/utils/peanut-claim.utils', () => ({
    getContractAddress: () => '0xvault',
    signWithdrawalMessage: async () => ['1', '0xrecipient', '0xsig'],
}))
jest.mock('@/services/rhino-sda', () => ({
    provisionSdaTransfer: jest.fn(async () => ({ sdaAddress: '0x' + '22'.repeat(20) })),
}))
jest.mock('@/services/sendLinks', () => ({ sendLinksApi: {}, ESendLinkStatus: { FAILED: 'FAILED' } }))

import useClaimLink from '../useClaimLink'

function mockClaimResponse(status: number, body: unknown) {
    global.fetch = jest.fn().mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        statusText: 'x',
        json: async () => body,
    }) as unknown as typeof fetch
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
)

const claim = () =>
    renderHook(() => useClaimLink(), { wrapper }).result.current.claimLink({
        address: '0x1111111111111111111111111111111111111111',
        link: 'https://peanut.to/claim#p=pw',
    })

// x-chain posts to the same /claim endpoint after provisioning a Rhino SDA;
// Arbitrum → Arbitrum USDC keeps the real chain/token resolvers happy
const claimXchain = () =>
    renderHook(() => useClaimLink(), { wrapper }).result.current.claimLinkXchain({
        address: '0x1111111111111111111111111111111111111111',
        link: 'https://peanut.to/claim#p=pw',
        destinationChainId: '42161',
        destinationToken: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    })

const originalFetch = global.fetch
afterEach(() => {
    global.fetch = originalFetch
    jest.clearAllMocks()
})

describe('claimLinkMutation.onError', () => {
    test('an already-claimed 409 is rethrown to the caller but not reported to Sentry', async () => {
        mockClaimResponse(409, { error: 'This link was already claimed.', code: 'LINK_ALREADY_CLAIMED' })

        await expect(claim()).rejects.toMatchObject({ code: 'LINK_ALREADY_CLAIMED' })

        expect(mockCaptureException).not.toHaveBeenCalled()
    })

    test('any other claim failure still reaches Sentry', async () => {
        mockClaimResponse(500, { error: 'An unexpected error occurred.' })

        await expect(claim()).rejects.toBeTruthy()

        expect(mockCaptureException).toHaveBeenCalledTimes(1)
    })

    test('the x-chain mutation skips Sentry for the same already-claimed 409', async () => {
        mockClaimResponse(409, { error: 'This link was already claimed.', code: 'LINK_ALREADY_CLAIMED' })

        await expect(claimXchain()).rejects.toMatchObject({ code: 'LINK_ALREADY_CLAIMED' })

        expect(mockCaptureException).not.toHaveBeenCalled()
    })

    test('the x-chain mutation still reports any other failure', async () => {
        mockClaimResponse(500, { error: 'An unexpected error occurred.' })

        await expect(claimXchain()).rejects.toBeTruthy()

        expect(mockCaptureException).toHaveBeenCalledTimes(1)
    })
})
