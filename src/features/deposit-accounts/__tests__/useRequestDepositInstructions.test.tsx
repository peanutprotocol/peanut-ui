import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { useRequestDepositInstructions } from '../useRequestDepositInstructions'

const depositInstructions = jest.fn()
jest.mock('@/services/requests', () => ({
    requestsApi: { depositInstructions: (...args: unknown[]) => depositInstructions(...args) },
}))

const INSTRUCTIONS = {
    depositAccount: {
        id: 'acc-1',
        railId: 'bridge.sepa_eu',
        country: 'DEU',
        currency: 'EUR',
        status: 'active',
        isPrimary: true,
        matching: { nameOnAccount: 'user', sender: 'anyone' },
        instructions: { accountHolderName: 'Ana Pérez', iban: 'DE00', paymentRails: ['sepa'] },
    },
    paymentReference: 'a1b2c3d4',
}

const wrapper = ({ children }: { children: ReactNode }) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => jest.clearAllMocks())

describe('useRequestDepositInstructions', () => {
    it('returns the requester bank details and the reference', async () => {
        depositInstructions.mockResolvedValue(INSTRUCTIONS)

        const { result } = renderHook(() => useRequestDepositInstructions('req-1', true), { wrapper })

        await waitFor(() => expect(result.current.instructions).toEqual(INSTRUCTIONS))
        expect(result.current.instructions?.paymentReference).toBe('a1b2c3d4')
        expect(result.current.isUnavailable).toBe(false)
        expect(depositInstructions).toHaveBeenCalledWith('req-1')
    })

    // A 404 is the backend's answer for a requester who did not opt in, and
    // for one who did but holds no account. The screen must read it as "not
    // offered", never as a failed load it could retry.
    it('reads an opted-out request as unavailable rather than an error', async () => {
        depositInstructions.mockResolvedValue(null)

        const { result } = renderHook(() => useRequestDepositInstructions('req-1', true), { wrapper })

        await waitFor(() => expect(result.current.isUnavailable).toBe(true))
        expect(result.current.instructions).toBeUndefined()
    })

    it('does not ask about a request that shares no bank details', () => {
        renderHook(() => useRequestDepositInstructions('req-1', false), { wrapper })

        expect(depositInstructions).not.toHaveBeenCalled()
    })
})
