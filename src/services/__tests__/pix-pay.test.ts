/** @jest-environment node */
/**
 * The neutral pay routes (API-CONTRACT-M4 §2): what each call sends, and what a refusal carries.
 * The fetch layer is stubbed, not the service, so the request the API receives is what is asserted.
 */
import { pixApi } from '@/services/pix'
import { ApiError } from '@/services/api-error'
import { apiFetch } from '@/utils/api-fetch'

jest.mock('@/utils/api-fetch', () => ({ apiFetch: jest.fn() }))

const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>
const reply = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const DISPLAY = {
    amountBrl: '42.50',
    amountFixed: true,
    merchantName: 'PADARIA PAO DOURADO LTDA',
    merchantTaxIdMasked: '12.345.678/0001-95',
    bankName: 'Banco Inter S.A.',
    withdrawUsd: '8.062211',
    rate: '5.364547',
    fixedFeeBrl: '0.75',
    arrivalEstimateSeconds: 60,
    provider: 'Avenia',
}

beforeEach(() => jest.clearAllMocks())

describe('pixApi pay routes', () => {
    it('reviews a code: POST /pix/pay/preview with the code alone', async () => {
        mockApiFetch.mockResolvedValue(reply(200, DISPLAY))
        await expect(pixApi.previewPayment({ brCode: '000201' })).resolves.toEqual(DISPLAY)
        expect(mockApiFetch).toHaveBeenCalledWith('/pix/pay/preview', {
            method: 'POST',
            body: JSON.stringify({ brCode: '000201' }),
        })
    })

    it('opens a payment with its spend ceiling and idempotency key', async () => {
        const opened = { provider: 'avenia', intentId: 'pay-1', display: DISPLAY, sign: { kind: 'deposit-with-id' } }
        mockApiFetch.mockResolvedValue(reply(200, opened))
        const request = { brCode: '000201', maxSpendUsd: '8.062211', idempotencyKey: 'key-1' }
        await expect(pixApi.openPayment(request)).resolves.toEqual(opened)
        expect(mockApiFetch).toHaveBeenCalledWith('/pix/pay', { method: 'POST', body: JSON.stringify(request) })
    })

    it('a payment already past its signature refuses with its intentId, for the flow to read', async () => {
        mockApiFetch.mockResolvedValue(
            reply(409, { error: 'This payment is already on its way', code: 'PIX_PAYMENT_EXISTS', intentId: 'pay-1' })
        )
        const caught = await pixApi
            .openPayment({ brCode: '000201', maxSpendUsd: '8.06', idempotencyKey: 'key-1' })
            .catch((error: unknown) => error)
        expect(caught).toBeInstanceOf(ApiError)
        expect(caught).toMatchObject({ status: 409, code: 'PIX_PAYMENT_EXISTS', intentId: 'pay-1' })
    })

    it('an amount under the floor names the smallest payment', async () => {
        mockApiFetch.mockResolvedValue(
            reply(400, { error: 'Too small', code: 'PIX_MIN_AMOUNT', minAmount: '2.70', currency: 'BRL' })
        )
        await expect(pixApi.previewPayment({ brCode: '000201', amountBrl: '1' })).rejects.toMatchObject({
            code: 'PIX_MIN_AMOUNT',
            minimum: { amount: '2.70', currency: 'BRL' },
        })
    })

    it('reports the funding hash and reads the payment by its id', async () => {
        mockApiFetch.mockResolvedValueOnce(reply(200, { status: 'PROCESSING' }))
        await pixApi.reportPaymentFunding('pay/1', '0xabc')
        expect(mockApiFetch).toHaveBeenCalledWith('/pix/pay/pay%2F1/funded', {
            method: 'POST',
            body: JSON.stringify({ txHash: '0xabc' }),
        })

        const read = { provider: 'avenia', intentId: 'pay-1', state: 'paid', status: 'COMPLETED', amountBrl: '42.50' }
        mockApiFetch.mockResolvedValueOnce(reply(200, read))
        await expect(pixApi.readPayment('pay-1')).resolves.toEqual(read)
        expect(mockApiFetch).toHaveBeenLastCalledWith('/pix/pay/pay-1', { method: 'GET' })
    })
})
