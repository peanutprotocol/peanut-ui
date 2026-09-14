/**
 * executeClaim must carry the API's `code` onto the thrown error.
 *
 * The discriminant was being dropped at the fetch boundary — postJson threw a
 * bare `new Error(data.error)` — so friendlyError only ever saw the sanitized
 * 500 prose and answered "contact support" for a claim the API had already
 * rolled back and marked retryable (PEANUT-UI-SJ5).
 */
import { friendlyError } from '@/utils/friendly-error.utils'

jest.mock('@/utils/peanut-link.utils', () => ({
    generateKeysFromString: () => ({ address: '0xdead', privateKey: '0xbeef' }),
    getParamsFromLink: () => ({ password: 'pw', chainId: '42161', contractVersion: 'v4.4', depositIdx: 1 }),
}))

jest.mock('@/utils/peanut-claim.utils', () => ({
    getContractAddress: () => '0xvault',
    signWithdrawalMessage: async () => ['1', '0xrecipient', '0xsig'],
}))

import { executeClaim } from '../useClaimLink'

const CLAIM_ARGS = {
    link: 'https://peanut.to/claim#p=pw',
    recipientAddress: '0x1111111111111111111111111111111111111111',
    baseUrl: 'https://api.peanut.me/claim',
}

function mockClaimResponse(status: number, body: unknown) {
    global.fetch = jest.fn().mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        statusText: 'Service Unavailable',
        json: async () => body,
    }) as unknown as typeof fetch
}

const originalFetch = global.fetch
afterEach(() => {
    global.fetch = originalFetch
})

describe('executeClaim error propagation', () => {
    test('a coded 503 reaches friendlyError as retryable copy', async () => {
        mockClaimResponse(503, {
            error: 'An unexpected error occurred. Please try again or contact support.',
            code: 'CHAIN_INFRA_UNAVAILABLE',
        })

        const error = await executeClaim(CLAIM_ARGS).catch((e) => e)

        expect((error as { code?: string }).code).toBe('CHAIN_INFRA_UNAVAILABLE')
        expect(friendlyError(error)).toEqual({ kind: 'code', code: 'networkBusyTimeout' })
    })

    test('a 409 on an already-claimed link carries LINK_ALREADY_CLAIMED (TASK-22091)', async () => {
        mockClaimResponse(409, { error: 'This link was already claimed.', code: 'LINK_ALREADY_CLAIMED' })

        const error = await executeClaim(CLAIM_ARGS).catch((e) => e)

        expect((error as { code?: string }).code).toBe('LINK_ALREADY_CLAIMED')
        expect(friendlyError(error)).toEqual({ kind: 'code', code: 'sendLinkAlreadyClaimed' })
    })

    test('an uncoded failure keeps its message and the support fallback', async () => {
        mockClaimResponse(500, { error: 'An unexpected error occurred. Please try again or contact support.' })

        const error = await executeClaim(CLAIM_ARGS).catch((e) => e)

        expect((error as { code?: string }).code).toBeUndefined()
        expect(friendlyError(error)).toEqual({ kind: 'code', code: 'genericSupport' })
    })

    test('a 200 body carrying an error still propagates its code', async () => {
        // the API can answer 200 with {error} — that branch dropped the code too
        mockClaimResponse(200, { error: 'boom', code: 'CHAIN_INFRA_UNAVAILABLE' })

        const error = await executeClaim(CLAIM_ARGS).catch((e) => e)

        expect((error as { code?: string }).code).toBe('CHAIN_INFRA_UNAVAILABLE')
    })
})
