/**
 * The link preview of a payment request (WhatsApp, X, Telegram) is built
 * before anyone taps the link. A request is paid in USDC or USDT only
 * (TASK-23850), and the page refuses any other token, so the preview must not
 * advertise "0.1 ETH". A refused link gets the same neutral metadata as a link
 * the app cannot show: no card of its own, so the site-wide Peanut card applies.
 */
import { buildPaymentMetadata } from '../payment-metadata'
import { chargesApi } from '@/services/charges'

jest.mock('@/lib/hosting/get-origin', () => ({ __esModule: true, default: async () => 'https://peanut.me' }))
jest.mock('@/services/charges', () => ({ chargesApi: { get: jest.fn() } }))

const mockGetCharge = chargesApi.get as jest.MockedFunction<typeof chargesApi.get>

const ADDRESS = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'
// the metadata a link the app cannot show gets (a reserved route, a non-recipient)
const NEUTRAL = { robots: { index: false, follow: false }, alternates: { canonical: null } }

const ogImage = (metadata: Awaited<ReturnType<typeof buildPaymentMetadata>>) =>
    new URL(((metadata as { openGraph?: { images: { url: string }[] } }).openGraph?.images ?? [])[0]?.url)

describe('buildPaymentMetadata for request tokens', () => {
    beforeEach(() => jest.clearAllMocks())

    it('keeps the amount preview of a USDC request', async () => {
        const metadata = await buildPaymentMetadata([`${ADDRESS}@base`, '10usdc'])

        expect(metadata).toEqual(expect.objectContaining({ title: '0x5aae...1beaed is requesting $10 via Peanut' }))
        const image = ogImage(metadata)
        expect(image.pathname).toBe('/api/og')
        expect(image.searchParams.get('amount')).toBe('10')
        expect(image.searchParams.get('token')).toBe('USDC')
    })

    it.each([
        ['an ETH request to an address', [`${ADDRESS}@base`, '0.1eth']],
        ['an ETH request to a username', ['alice', '10eth']],
        ['a DAI request', [`${ADDRESS}@ethereum`, '10dai']],
    ])('gives %s the neutral preview, never its amount', async (_case, segments) => {
        expect(await buildPaymentMetadata(segments)).toEqual(NEUTRAL)
    })

    describe('a request opened by its charge id', () => {
        const ethCharge = (paid: boolean) =>
            ({
                tokenAmount: '0.1',
                tokenSymbol: 'ETH',
                fulfillmentPayment: paid ? { status: 'SUCCESSFUL' } : null,
                payments: paid ? [{ status: 'SUCCESSFUL', payerAccount: { user: { username: 'bob' } } }] : [],
                requestee: null,
            }) as unknown as Awaited<ReturnType<typeof chargesApi.get>>

        it('an unpaid ETH charge gets the neutral preview', async () => {
            mockGetCharge.mockResolvedValue(ethCharge(false))
            expect(await buildPaymentMetadata([ADDRESS], 'charge-eth')).toEqual(NEUTRAL)
        })

        it('a paid ETH charge keeps its receipt preview', async () => {
            mockGetCharge.mockResolvedValue(ethCharge(true))
            const metadata = await buildPaymentMetadata([ADDRESS], 'charge-eth')

            expect(metadata).toEqual(expect.objectContaining({ title: 'bob shared a receipt for 0.1 ETH via Peanut' }))
            expect(ogImage(metadata).searchParams.get('isReceipt')).toBe('true')
        })
    })
})
