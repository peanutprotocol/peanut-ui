import { apiErrorFromResponse } from '@/services/api-error'

const response = (status: number, body: unknown) =>
    ({ status, text: async () => JSON.stringify(body) }) as unknown as Response

describe('apiErrorFromResponse', () => {
    // api#1738: guarded Bridge routes refuse a restricted residence with
    // { error, code, userMessage }; the copy written for users wins
    it('prefers userMessage and keeps the code', async () => {
        const error = await apiErrorFromResponse(
            response(403, {
                error: 'internal wording',
                message: 'developer message',
                code: 'residence_bank_restricted',
                userMessage: 'Bank transfers are not available for your current or pending residence.',
            }),
            'fallback'
        )
        expect(error.message).toBe('Bank transfers are not available for your current or pending residence.')
        expect(error.code).toBe('residence_bank_restricted')
        expect(error.status).toBe(403)
    })

    it('falls back to message, then error, then the fallback', async () => {
        expect((await apiErrorFromResponse(response(400, { message: 'm', error: 'e' }), 'f')).message).toBe('m')
        expect((await apiErrorFromResponse(response(400, { error: 'e' }), 'f')).message).toBe('e')
        expect((await apiErrorFromResponse(response(400, {}), 'f')).message).toBe('f')
    })
})
