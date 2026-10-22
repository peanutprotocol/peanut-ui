/**
 * Where a signed-in visit to a payment link for an EVM address or ENS name
 * enters the crypto withdrawal (TASK-23974).
 *
 * The link goes through the same in-process hand-off a scan uses, so the entry
 * URL carries a scan id and never the address. A link the withdrawal cannot pay
 * as written gives null, and the caller keeps the payment page.
 */
const mockConfig = { disableXchainWithdraw: false }
jest.mock('@/config/underMaintenance.config', () => ({ __esModule: true, default: mockConfig }))
jest.mock('@/app/actions/ens', () => ({ resolveEns: jest.fn() }))
jest.mock('@/utils/api-fetch', () => ({ serverFetch: jest.fn() }))

import { resolveEns } from '@/app/actions/ens'
import { SCAN_ID_PARAM, clearScannedDestination, takeScannedDestination } from '../destination'
import { withdrawEntryForLink } from '../link-destination'

const mockResolveEns = resolveEns as jest.MockedFunction<typeof resolveEns>

const ADDRESS = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'
const RESOLVED = '0x1111111111111111111111111111111111111111'
const BASE_USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'

/** The entry URL's path and query, and the destination its scan id hands over. */
const entryFor = async (segments: string[]) => {
    const url = await withdrawEntryForLink(segments)
    if (!url) return null
    const [path, query] = url.split('?')
    const params = new URLSearchParams(query)
    return { url, path, params, destination: takeScannedDestination(params.get(SCAN_ID_PARAM)) }
}

beforeEach(() => {
    mockConfig.disableXchainWithdraw = false
    mockResolveEns.mockReset()
    clearScannedDestination()
})

describe('withdrawEntryForLink', () => {
    it('enters a bare address with its network left to the user, and keeps it out of the URL', async () => {
        const entry = await entryFor([ADDRESS])

        expect(entry?.path).toBe('/withdraw')
        expect(Object.fromEntries(entry!.params)).toEqual({
            step: 'amount',
            method: 'crypto',
            [SCAN_ID_PARAM]: expect.any(String),
        })
        expect(entry?.url.toLowerCase()).not.toContain(ADDRESS.toLowerCase())
        expect(entry?.destination).toEqual({ address: ADDRESS, networkPending: true })
    })

    it.each([
        ['by name', 'base'],
        ['by id', '8453'],
    ])('takes the chain a link names %s', async (_case, chain) => {
        const entry = await entryFor([`${ADDRESS}@${chain}`])

        expect(entry?.destination).toMatchObject({ address: ADDRESS, chainId: '8453', networkPending: false })
    })

    it('pays the token and amount a link asks for, with the contract the chain lists', async () => {
        const entry = await entryFor([`${ADDRESS}@8453`, '10USDC'])

        expect(entry?.params.get('amount')).toBe('10')
        expect(entry?.destination).toMatchObject({
            address: ADDRESS,
            chainId: '8453',
            tokenSymbol: 'USDC',
            tokenAddress: BASE_USDC,
        })
    })

    it.each([
        ['a token the chain does not pay out', [`${ADDRESS}@137`, '1ETH']],
        ['a token with no chain to check it against', [ADDRESS, '10USDC']],
        ['an amount with no chain', [ADDRESS, '10']],
        ['an unknown chain', [`${ADDRESS}@notachain`]],
        ['an amount that is not a number', [`${ADDRESS}@8453`, '1.2.3USDC']],
    ])('refuses %s', async (_case, segments) => {
        expect(await withdrawEntryForLink(segments)).toBeNull()
    })

    it('resolves a name on the wallet chain and keeps the name beside the address', async () => {
        mockResolveEns.mockResolvedValue(RESOLVED)

        const entry = await entryFor(['vitalik.eth'])

        expect(mockResolveEns).toHaveBeenCalledWith('vitalik.eth', '42161')
        expect(entry?.url).not.toContain(RESOLVED)
        expect(entry?.destination).toEqual({ address: RESOLVED, name: 'vitalik.eth', networkPending: true })
    })

    it('resolves a name on the chain the link names', async () => {
        mockResolveEns.mockResolvedValue(RESOLVED)

        const entry = await entryFor(['vitalik.eth@base'])

        expect(mockResolveEns).toHaveBeenCalledWith('vitalik.eth', '8453')
        expect(entry?.destination).toMatchObject({ address: RESOLVED, name: 'vitalik.eth', chainId: '8453' })
    })

    it('refuses a name that does not resolve', async () => {
        mockResolveEns.mockResolvedValue(undefined)

        expect(await withdrawEntryForLink(['nobody.eth'])).toBeNull()
    })

    // Two links in quick succession: the older one's name lookup finishes after
    // the newer link has stashed and left. The hand-off holds one destination,
    // so the late call must not overwrite the newer link's (Chip, #3802).
    it('lets a newer link win over an older one that resolves late', async () => {
        let resolveOlder!: (address: string) => void
        mockResolveEns.mockReturnValueOnce(new Promise<string>((resolve) => (resolveOlder = resolve)))
        const older = withdrawEntryForLink(['vitalik.eth'])
        const newerUrl = (await withdrawEntryForLink([ADDRESS]))!
        resolveOlder(RESOLVED)

        expect(await older).toBeNull()
        const newerId = new URLSearchParams(newerUrl.split('?')[1]).get(SCAN_ID_PARAM)
        expect(takeScannedDestination(newerId)).toEqual({ address: ADDRESS, networkPending: true })
    })

    describe('with the ops kill-switch on', () => {
        beforeEach(() => {
            mockConfig.disableXchainWithdraw = true
        })

        it('still enters a bare address, with no network to pick', async () => {
            const entry = await entryFor([ADDRESS])

            expect(entry?.destination).toEqual({ address: ADDRESS, networkPending: false })
        })

        it('refuses a link that names a chain', async () => {
            expect(await withdrawEntryForLink([`${ADDRESS}@8453`])).toBeNull()
            expect(await withdrawEntryForLink([`${ADDRESS}@8453`, '10USDC'])).toBeNull()
        })
    })
})
