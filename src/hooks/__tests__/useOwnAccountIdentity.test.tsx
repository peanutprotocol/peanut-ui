import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuth } from '@/context/authContext'
import { apiFetch } from '@/utils/api-fetch'
import { useOwnAccountIdentity } from '../useOwnAccountIdentity'

jest.mock('@/context/authContext', () => ({ useAuth: jest.fn() }))
jest.mock('@/utils/api-fetch', () => ({ apiFetch: jest.fn() }))

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>
const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>

const VERIFIED_ADDRESS_PATH = '/users/me/verified-address'

// Synthetic throughout — no real person's name or address belongs in a test.
const setUser = (fullName: string | null, bridgeCustomerId: string | null = 'cus_1') => {
    mockUseAuth.mockReturnValue({
        user: { user: { fullName, bridgeCustomerId } },
    } as unknown as ReturnType<typeof useAuth>)
}

type Reply = { status?: number; ok?: boolean; body?: unknown }
let savedAccountsReply: Reply | Error = { body: [] }
let verifiedReply: Reply | Error = { status: 204 }
/** The verified-address route was asked this many times. */
let verifiedCalls = 0

const respond = (reply: Reply): Response =>
    ({
        ok: reply.ok ?? (reply.status ?? 200) < 400,
        status: reply.status ?? 200,
        json: async () => reply.body,
    }) as unknown as Response

beforeEach(() => {
    jest.clearAllMocks()
    savedAccountsReply = { body: [] }
    verifiedReply = { status: 204 }
    verifiedCalls = 0
    mockApiFetch.mockImplementation(async (path: string) => {
        if (path === VERIFIED_ADDRESS_PATH) {
            verifiedCalls += 1
            if (verifiedReply instanceof Error) throw verifiedReply
            return respond(verifiedReply)
        }
        if (savedAccountsReply instanceof Error) throw savedAccountsReply
        return respond(savedAccountsReply)
    })
})

const wrapper = ({ children }: { children: React.ReactNode }) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const render = (isOwnAccount: boolean = true) =>
    renderHook(() => useOwnAccountIdentity(true, isOwnAccount), { wrapper })

/**
 * Every read this hook could make has either happened or been ruled out.
 *
 * The second read is enabled by the first one's result, so one flush is not
 * enough to prove it never comes.
 */
const settled = async () => {
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalled())
    for (let pass = 0; pass < 3; pass += 1) {
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0))
        })
    }
}

const SAVED_ACCOUNT_ADDRESS = {
    street_line_1: '1 Test Street',
    city: 'Testville',
    state: 'NY',
    postal_code: '00100',
    country: 'USA',
}

const VERIFIED_BODY = {
    streetLine1: '9 Sample Road',
    city: 'Sampleton',
    postalCode: '99999',
    subdivisionCode: 'CA',
    countryCode: 'US',
}

describe('useOwnAccountIdentity — the name', () => {
    it('gives back the verified name on the profile', () => {
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

describe('useOwnAccountIdentity — the address the bank already accepted', () => {
    it("reads it off the person's own earlier payout account", async () => {
        setUser('Anna Rossi')
        savedAccountsReply = { body: [{ id: 'ext_1', address: SAVED_ACCOUNT_ADDRESS }] }
        const { result } = render()
        await waitFor(() =>
            expect(result.current.address).toEqual({
                street: '1 Test Street',
                city: 'Testville',
                state: 'NY',
                postalCode: '00100',
                countryCode: 'USA',
            })
        )
    })

    it('skips an incomplete address and takes the next complete one', async () => {
        setUser('Anna Rossi')
        savedAccountsReply = {
            body: [
                { id: 'ext_1', address: { street_line_1: '1 Test Street', city: '', country: 'USA' } },
                {
                    id: 'ext_2',
                    address: { street_line_1: '2 Test Street', city: 'Testville', postal_code: '00200' },
                },
            ],
        }
        const { result } = render()
        await waitFor(() => expect(result.current.address?.street).toBe('2 Test Street'))
        expect(result.current.address?.countryCode).toBeNull()
    })

    /** It is the address the provider already took, so nothing else is asked. */
    it('wins over the verified address, which is never even read', async () => {
        setUser('Anna Rossi')
        savedAccountsReply = { body: [{ id: 'ext_1', address: SAVED_ACCOUNT_ADDRESS }] }
        verifiedReply = { body: VERIFIED_BODY }
        const { result } = render()
        await waitFor(() => expect(result.current.address?.street).toBe('1 Test Street'))
        await settled()
        expect(verifiedCalls).toBe(0)
    })

    it('asks for nothing when the user has no payout profile yet', async () => {
        setUser('Anna Rossi', null)
        render()
        await settled()
        expect(mockApiFetch).not.toHaveBeenCalledWith(expect.stringContaining('/bridge/customers'), expect.anything())
    })
})

describe('useOwnAccountIdentity — the verified address', () => {
    it('fills the gap when there is no earlier payout account', async () => {
        setUser('Anna Rossi')
        verifiedReply = { body: VERIFIED_BODY }
        const { result } = render()
        await waitFor(() =>
            expect(result.current.address).toEqual({
                street: '9 Sample Road',
                city: 'Sampleton',
                state: 'CA',
                postalCode: '99999',
                countryCode: 'US',
            })
        )
    })

    it('is not read at all when the account is not the person’s own', async () => {
        setUser('Anna Rossi')
        verifiedReply = { body: VERIFIED_BODY }
        const { result } = render(false)
        await settled()
        expect(verifiedCalls).toBe(0)
        expect(result.current.address).toBeNull()
    })

    it('is read once, however many times the hook renders', async () => {
        setUser('Anna Rossi')
        verifiedReply = { body: VERIFIED_BODY }
        const { result, rerender } = render()
        await waitFor(() => expect(result.current.address).not.toBeNull())
        rerender()
        rerender()
        await settled()
        expect(verifiedCalls).toBe(1)
    })

    it.each([
        ['204, nothing to prefill', { status: 204 } as Reply],
        ['401, the session is gone', { status: 401, body: { error: 'Unauthorized' } } as Reply],
        [
            '429, asked too often',
            { status: 429, body: { error: 'Too many requests', code: 'VERIFIED_ADDRESS_RATE_LIMITED' } } as Reply,
        ],
        ['404, a deployment without the route', { status: 404, body: {} } as Reply],
        ['a body missing the street', { body: { ...VERIFIED_BODY, streetLine1: '' } } as Reply],
    ])('%s: the form is left empty, and nothing is shown to the user', async (_, reply) => {
        setUser('Anna Rossi')
        verifiedReply = reply
        const { result } = render()
        await waitFor(() => expect(verifiedCalls).toBe(1))
        await settled()
        expect(result.current.address).toBeNull()
        expect(result.current.ownerName).toBe('Anna Rossi')
        // one attempt, never a retry storm
        expect(verifiedCalls).toBe(1)
    })

    it('a network fault is the same answer, and is not retried', async () => {
        setUser('Anna Rossi')
        verifiedReply = new Error('offline')
        const { result } = render()
        await waitFor(() => expect(verifiedCalls).toBe(1))
        await settled()
        expect(result.current.address).toBeNull()
        expect(verifiedCalls).toBe(1)
    })

    it('keeps a missing state and country as nulls rather than inventing them', async () => {
        setUser('Anna Rossi')
        verifiedReply = { body: { ...VERIFIED_BODY, subdivisionCode: null, countryCode: null } }
        const { result } = render()
        await waitFor(() => expect(result.current.address?.street).toBe('9 Sample Road'))
        expect(result.current.address?.state).toBe('')
        expect(result.current.address?.countryCode).toBeNull()
    })
})
