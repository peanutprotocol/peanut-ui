/**
 * The charge is the only place a typed ENS name can reach the server: the app
 * resolves ENS in the browser and pays the address, so without this field the
 * server never learns a name was used and the ENS badge can never be earned.
 *
 * The rule the payload has to keep: send a name, never an address, never a bare
 * Peanut username (`alice` is a handle, `alice.peanut.me` is a name).
 */

import { renderHook, act } from '@testing-library/react'
import { type Address } from 'viem'

const mockCreate = jest.fn()
const mockGet = jest.fn()

jest.mock('@/services/charges', () => ({
    chargesApi: {
        create: (...args: unknown[]) => mockCreate(...args),
        get: (...args: unknown[]) => mockGet(...args),
    },
}))

jest.mock('@/services/requests', () => ({
    requestsApi: { get: jest.fn() },
}))

// must come after the jest.mock calls above
import { useChargeManager } from '../useChargeManager'

const RECIPIENT = '0xA4Ae9480de19bD99A55E0FdC5372B8A4151C8271' as Address

const baseParams = {
    tokenAmount: '10',
    tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as Address,
    chainId: '42161',
    tokenSymbol: 'USDC',
    tokenDecimals: 6,
    recipientAddress: RECIPIENT,
}

const createCharge = async (recipientEnsName?: string) => {
    const { result } = renderHook(() => useChargeManager())
    await act(async () => {
        await result.current.createCharge({ ...baseParams, recipientEnsName })
    })
    return mockCreate.mock.calls[0][0].requestProps as Record<string, unknown>
}

describe('useChargeManager — recipientEnsName', () => {
    beforeEach(() => {
        mockCreate.mockReset().mockResolvedValue({ data: { id: 'charge-1' } })
        mockGet.mockReset().mockResolvedValue({ uuid: 'charge-1' })
    })

    it.each([
        ['an ENS name', 'vitalik.eth', 'vitalik.eth'],
        ['a Peanut subname', 'alice.peanut.me', 'alice.peanut.me'],
        ['a name typed with capitals or padding', '  Vitalik.ETH ', 'vitalik.eth'],
        ['a bare Peanut username', 'alice', undefined],
        ['an address', RECIPIENT, undefined],
        ['nothing at all', undefined, undefined],
    ])('given %s, sends %p as %p', async (_case, typed, expected) => {
        const requestProps = await createCharge(typed)

        expect(requestProps.recipientEnsName).toBe(expected)
        // Absent, not `undefined` — an explicit undefined would still be a key on
        // the multipart JSON blob the API parses.
        expect('recipientEnsName' in requestProps).toBe(expected !== undefined)
        // The address is what actually gets paid, name or no name.
        expect(requestProps.recipientAddress).toBe(RECIPIENT)
    })
})
