import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuth } from '@/context/authContext'
import { apiFetch } from '@/utils/api-fetch'
import { useOwnAccountIdentity } from './useOwnAccountIdentity'

jest.mock('@/context/authContext', () => ({ useAuth: jest.fn() }))
jest.mock('@/utils/api-fetch', () => ({ apiFetch: jest.fn() }))

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>
const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>

// Synthetic throughout — no real person's name or address belongs in a test.
const setUser = (fullName: string | null, bridgeCustomerId: string | null = 'cus_1') => {
    mockUseAuth.mockReturnValue({
        user: { user: { fullName, bridgeCustomerId } },
    } as unknown as ReturnType<typeof useAuth>)
}

const accountsRespond = (accounts: unknown) => {
    mockApiFetch.mockResolvedValue({ ok: true, json: async () => accounts } as unknown as Response)
}

const wrapper = ({ children }: { children: React.ReactNode }) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const render = () => renderHook(() => useOwnAccountIdentity(), { wrapper })

beforeEach(() => {
    jest.clearAllMocks()
    accountsRespond([])
})

describe('useOwnAccountIdentity — the name', () => {
    it('gives back the verified name on the profile', async () => {
        setUser('Anna Rossi')
        const { result } = render()
        expect(result.current.ownerName).toBe('Anna Rossi')
    })

    it('refuses a single word: the provider needs a first and a last name', () => {
        setUser('Anna')
        const { result } = render()
        expect(result.current.ownerName).toBeNull()
    })

    it('refuses a name we do not hold', () => {
        setUser(null)
        const { result } = render()
        expect(result.current.ownerName).toBeNull()
    })
})

describe('useOwnAccountIdentity — the address', () => {
    it("reads the address off the person's own earlier payout account", async () => {
        setUser('Anna Rossi')
        accountsRespond([
            {
                id: 'ext_1',
                address: {
                    street_line_1: '1 Test Street',
                    city: 'Testville',
                    state: 'NY',
                    postal_code: '00100',
                    country: 'USA',
                },
            },
        ])
        const { result } = render()
        await waitFor(() =>
            expect(result.current.address).toEqual({
                street: '1 Test Street',
                city: 'Testville',
                state: 'NY',
                postalCode: '00100',
            })
        )
    })

    it('skips an incomplete address and takes the next complete one', async () => {
        setUser('Anna Rossi')
        accountsRespond([
            { id: 'ext_1', address: { street_line_1: '1 Test Street', city: '', country: 'USA' } },
            {
                id: 'ext_2',
                address: { street_line_1: '2 Test Street', city: 'Testville', postal_code: '00200', country: 'USA' },
            },
        ])
        const { result } = render()
        await waitFor(() =>
            expect(result.current.address).toEqual({
                street: '2 Test Street',
                city: 'Testville',
                state: '',
                postalCode: '00200',
            })
        )
    })

    it('a first payout has no earlier address, so there is none to fill in', async () => {
        setUser('Anna Rossi')
        accountsRespond([])
        const { result } = render()
        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.address).toBeNull()
    })

    it('a read that fails leaves the form as it was, and never throws', async () => {
        setUser('Anna Rossi')
        mockApiFetch.mockResolvedValue({ ok: false, json: async () => ({}) } as unknown as Response)
        const { result } = render()
        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.address).toBeNull()
        expect(result.current.ownerName).toBe('Anna Rossi')
    })

    it('asks for nothing when the user has no payout profile yet', () => {
        setUser('Anna Rossi', null)
        const { result } = render()
        expect(mockApiFetch).not.toHaveBeenCalled()
        expect(result.current.isLoading).toBe(false)
    })
})
