/** @jest-environment node */

import getOrigin from '@/lib/hosting/get-origin'
import { chargesApi } from '@/services/charges'
import { generateMetadata } from './page'

jest.mock('./client', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/0_Bruddle/PageContainer', () => ({ __esModule: true, default: () => null }))
jest.mock('next/navigation', () => ({ notFound: jest.fn() }))
jest.mock('@/utils/general.utils', () => ({
    printableAddress: (address: string) => `${address.slice(0, 6)}...${address.slice(-6)}`,
    isStableCoin: (token: string) => ['usdc', 'usdt'].includes(token.toLowerCase()),
}))
jest.mock('@/lib/hosting/get-origin', () => ({ __esModule: true, default: jest.fn() }))
jest.mock('@/services/charges', () => ({ chargesApi: { get: jest.fn() } }))

const mockedGetOrigin = jest.mocked(getOrigin)
const mockedChargeGet = jest.mocked(chargesApi.get)

async function metadata(recipient?: string[], chargeId?: string) {
    return generateMetadata({
        params: Promise.resolve({ recipient }),
        searchParams: Promise.resolve(chargeId ? { chargeId } : {}),
    })
}

type MetadataResult = Awaited<ReturnType<typeof metadata>>
type FullMetadataResult = Extract<MetadataResult, { title: string }>

function requireFullMetadata(result: MetadataResult): FullMetadataResult {
    if (!('title' in result)) throw new Error('Expected full recipient metadata')
    return result
}

function expectNoIndexWithoutCanonical(result: MetadataResult) {
    expect(result).toMatchObject({
        robots: { index: false, follow: false },
        alternates: { canonical: null },
    })
}

describe('recipient catch-all metadata', () => {
    beforeEach(() => {
        mockedGetOrigin.mockResolvedValue('https://preview.peanut.me')
        mockedChargeGet.mockReset()
    })

    it.each([
        ['missing recipient', undefined],
        ['reserved route', ['pricing']],
        ['invalid recipient shape', ['not-a-recipient']],
    ])('noindexes %s without a canonical', async (_name, recipient) => {
        expectNoIndexWithoutCanonical(await metadata(recipient))
        expect(mockedChargeGet).not.toHaveBeenCalled()
    })

    it.each([
        [['alice1'], 'alice1 on Peanut'],
        [['ALICE1'], 'alice1 on Peanut'],
        [['alice1@arbitrum'], 'alice1 on Peanut'],
        [['vitalik.eth'], 'vitalik.eth is requesting funds'],
        [['0x1234567890123456789012345678901234567890'], '0x1234...567890 is requesting funds'],
        [['alice1', '12.5USDC'], 'alice1 is requesting $12.5 via Peanut'],
    ])('keeps %j out of the index and generates useful card metadata', async (recipient, title) => {
        const result = await metadata(recipient)
        expectNoIndexWithoutCanonical(result)
        const full = requireFullMetadata(result)
        expect(full.title).toBe(title)
        expect(full.openGraph).toMatchObject({ title })
        expect(full.twitter).toMatchObject({ title, card: 'summary_large_image' })
    })

    it('falls back safely when an amount segment is malformed', async () => {
        const result = await metadata(['alice1', '1.2.3USDC'])
        expectNoIndexWithoutCanonical(result)
        const full = requireFullMetadata(result)
        expect(full.title).toBe('alice1 on Peanut')
        expect(String(full.title)).not.toContain('undefined')
    })

    it('renders unpaid request metadata from charge details', async () => {
        mockedChargeGet.mockResolvedValue({
            fulfillmentPayment: null,
            payments: [],
            requestee: { username: 'requestee' },
            tokenAmount: '7',
            tokenSymbol: 'USDC',
        } as never)
        const result = await metadata(['alice1'], 'unpaid-charge')
        expectNoIndexWithoutCanonical(result)
        expect(requireFullMetadata(result).title).toBe('alice1 is requesting $7 via Peanut')
        expect(mockedChargeGet).toHaveBeenCalledWith('unpaid-charge')
    })

    it('renders paid receipt metadata and marks its OG image as a receipt', async () => {
        mockedChargeGet.mockResolvedValue({
            fulfillmentPayment: { status: 'SUCCESSFUL' },
            payments: [
                {
                    status: 'SUCCESSFUL',
                    payerAccount: { user: { username: 'payer' } },
                },
            ],
            requestee: { username: 'requestee' },
            tokenAmount: '9',
            tokenSymbol: 'USDC',
        } as never)
        const result = await metadata(['alice1'], 'paid-charge')
        expectNoIndexWithoutCanonical(result)
        const full = requireFullMetadata(result)
        expect(full.title).toBe('payer shared a receipt for $9 via Peanut')
        expect(JSON.stringify(full.openGraph)).toContain('isReceipt=true')
    })

    it('does not 500 when charge lookup fails', async () => {
        mockedChargeGet.mockRejectedValue(new Error('timeout'))
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
        const result = await metadata(['alice1'], 'missing-charge')
        expectNoIndexWithoutCanonical(result)
        expect(requireFullMetadata(result).title).toBe('alice1 | Peanut')
        expect(errorSpy).toHaveBeenCalled()
        errorSpy.mockRestore()
    })
})
