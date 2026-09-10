/**
 * /claim carries the session token when one exists. Without it the backend's
 * optional auth never fires, so a claim paid to a Manteca entity address
 * (owned by no user) is unattributable — the claim-link → withdraw flow then
 * has no SEND_LINK_CLAIM intent to verify transfer ownership against.
 * Anonymous claimers must keep working with no header at all.
 */

import { executeClaim } from '../useClaimLink'

jest.mock('@/utils/peanut-link.utils', () => ({
    getParamsFromLink: jest.fn(() => ({
        password: 'link-secret',
        contractVersion: 'v4.2',
        chainId: '42161',
        depositIdx: '17',
    })),
    generateKeysFromString: jest.fn(() => ({ privateKey: '0xprivate' })),
}))
jest.mock('@/utils/peanut-claim.utils', () => ({
    getContractAddress: jest.fn(() => '0xcontract'),
    signWithdrawalMessage: jest.fn(async () => ({ signature: '0xsigned', recipient: '0xrecipient' })),
}))
jest.mock('@/constants/rhino.consts', () => ({ RHINO_SDA_ENABLED: false }))
jest.mock('@/services/rhino-sda', () => ({ provisionSdaTransfer: jest.fn() }))

const mockGetAuthToken = jest.fn<string | null, []>()
jest.mock('@/utils/auth-token', () => ({
    getAuthToken: () => mockGetAuthToken(),
}))

const depositDetails = {
    pubKey20: '0xpubkey',
    amount: '1000000',
    tokenAddress: '0xtoken',
    contractType: 0,
    claimed: false,
    requiresMFA: false,
    timestamp: 1_725_000_000,
    tokenId: '0',
    senderAddress: '0xsender',
}

describe('/claim auth header', () => {
    const originalFetch = global.fetch

    afterEach(() => {
        global.fetch = originalFetch
        jest.clearAllMocks()
    })

    async function runClaim() {
        const mockFetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue({ transactionHash: '0xclaimhash' }),
        })
        global.fetch = mockFetch as typeof fetch
        await executeClaim({
            link: 'https://peanut.me/claim?i=17',
            recipientAddress: '0xrecipient',
            depositDetails,
        } as never)
        return mockFetch.mock.calls[0][1] as RequestInit
    }

    it('attaches the bearer token for an authenticated session', async () => {
        mockGetAuthToken.mockReturnValue('jwt-123')

        const init = await runClaim()

        expect((init.headers as Record<string, string>).Authorization).toBe('Bearer jwt-123')
    })

    it('sends NO auth header for an anonymous claimer', async () => {
        mockGetAuthToken.mockReturnValue(null)

        const init = await runClaim()

        expect((init.headers as Record<string, string>).Authorization).toBeUndefined()
    })
})
