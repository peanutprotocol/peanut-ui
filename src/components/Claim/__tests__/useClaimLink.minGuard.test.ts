/**
 * executeClaimXChain must refuse a sub-minimum cross-chain claim BEFORE it signs
 * or submits.
 *
 * Rhino accepts an SDA deposit below the route minimum but never bridges it —
 * the funds strand at the deposit address with no auto-refund. The guard has to
 * throw after the (side-effect-free) SDA lookup but before signWithdrawalMessage
 * and the POST /claim, or a mis-thread silently restores the loss scenario.
 */
import { executeClaimXChain } from '../useClaimLink'

const mockGetParamsFromLink = jest.fn()
const mockGenerateKeysFromString = jest.fn()
const mockGetContractAddress = jest.fn()
const mockSignWithdrawalMessage = jest.fn()
const mockProvisionSdaTransfer = jest.fn()

jest.mock('@/utils/peanut-link.utils', () => ({
    getParamsFromLink: (...args: unknown[]) => mockGetParamsFromLink(...args),
    generateKeysFromString: (...args: unknown[]) => mockGenerateKeysFromString(...args),
}))

jest.mock('@/utils/peanut-claim.utils', () => ({
    getContractAddress: (...args: unknown[]) => mockGetContractAddress(...args),
    signWithdrawalMessage: (...args: unknown[]) => mockSignWithdrawalMessage(...args),
}))

jest.mock('@/constants/rhino.consts', () => ({
    evmChainIdToRhinoName: (chainId: string) => `rhino-${chainId}`,
}))

jest.mock('@/services/rhino-sda', () => ({
    provisionSdaTransfer: (...args: unknown[]) => mockProvisionSdaTransfer(...args),
}))

jest.mock('@/utils/general.utils', () => ({
    getTokenSymbol: () => 'USDC',
    isTestnetChain: () => false,
}))

const CLAIM_ARGS = {
    link: 'https://peanut.me/claim?i=17',
    recipientAddress: '0x1111111111111111111111111111111111111111',
    destinationChainId: '10',
    destinationToken: '0xusdc',
    baseUrl: '/claim',
}

const originalFetch = global.fetch

describe('executeClaimXChain sub-minimum guard', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockGetParamsFromLink.mockReturnValue({
            password: 'link-secret',
            contractVersion: 'v4.2',
            chainId: '42161',
            depositIdx: '17',
        })
        mockGenerateKeysFromString.mockReturnValue({ privateKey: '0xprivate' })
        mockGetContractAddress.mockReturnValue('0xcontract')
        mockSignWithdrawalMessage.mockResolvedValue({ signature: '0xsigned', recipient: '0xrecipient' })
    })

    afterEach(() => {
        global.fetch = originalFetch
    })

    function mockFetchOk() {
        const fetchMock = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue({ txHash: '0xxchainhash' }),
        })
        global.fetch = fetchMock as unknown as typeof fetch
        return fetchMock
    }

    it('rejects a below-minimum claim before signing or submitting', async () => {
        mockProvisionSdaTransfer.mockResolvedValue({ sdaAddress: '0xsda', minDepositLimitUsd: 5 })
        const fetchMock = mockFetchOk()

        await expect(executeClaimXChain({ ...CLAIM_ARGS, amountUsd: 2 })).rejects.toThrow(/at least \$5/)

        // The SDA lookup ran (that is how we learned the minimum)...
        expect(mockProvisionSdaTransfer).toHaveBeenCalledTimes(1)
        // ...but nothing that moves money did.
        expect(mockSignWithdrawalMessage).not.toHaveBeenCalled()
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('proceeds when the amount is at or above the minimum', async () => {
        mockProvisionSdaTransfer.mockResolvedValue({ sdaAddress: '0xsda', minDepositLimitUsd: 5 })
        const fetchMock = mockFetchOk()

        const result = await executeClaimXChain({ ...CLAIM_ARGS, amountUsd: 5 })

        expect(result).toBe('0xxchainhash')
        expect(mockSignWithdrawalMessage).toHaveBeenCalledTimes(1)
        expect(fetchMock).toHaveBeenCalledTimes(1)
        // The deposit identity is forwarded so the backend can read the amount
        // from chain (authoritative) instead of trusting a client figure.
        expect(mockProvisionSdaTransfer).toHaveBeenCalledWith(
            expect.objectContaining({
                context: 'claim-xchain',
                depositChainId: '42161',
                depositIdx: 17,
                depositContractVersion: 'v4.2',
            })
        )
    })

    it('rejects when the backend refuses to provision (sub-minimum) before signing', async () => {
        mockProvisionSdaTransfer.mockRejectedValue(
            Object.assign(new Error('Amount ($2.00) is below the $5 minimum to bridge to OPTIMISM.'), {
                code: 'BELOW_MIN_BRIDGE_AMOUNT',
            })
        )
        const fetchMock = mockFetchOk()

        await expect(executeClaimXChain({ ...CLAIM_ARGS, amountUsd: 2 })).rejects.toThrow(/below the \$5 minimum/)

        expect(mockSignWithdrawalMessage).not.toHaveBeenCalled()
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('does not block when no amount is supplied (price unknown)', async () => {
        mockProvisionSdaTransfer.mockResolvedValue({ sdaAddress: '0xsda', minDepositLimitUsd: 5 })
        const fetchMock = mockFetchOk()

        const result = await executeClaimXChain({ ...CLAIM_ARGS })

        expect(result).toBe('0xxchainhash')
        expect(mockSignWithdrawalMessage).toHaveBeenCalledTimes(1)
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('refuses (unverifiable) when the route minimum is missing or zero', async () => {
        // Rhino stores 0 when it omits supportedTokens — treat it as unknown, not
        // "no minimum", and do not sign against it.
        for (const sda of [{ sdaAddress: '0xsda' }, { sdaAddress: '0xsda', minDepositLimitUsd: 0 }]) {
            jest.clearAllMocks()
            mockGetParamsFromLink.mockReturnValue({
                password: 'link-secret',
                contractVersion: 'v4.2',
                chainId: '42161',
                depositIdx: '17',
            })
            mockSignWithdrawalMessage.mockResolvedValue({ signature: '0xsigned', recipient: '0xrecipient' })
            mockProvisionSdaTransfer.mockResolvedValue(sda)
            const fetchMock = mockFetchOk()

            await expect(executeClaimXChain({ ...CLAIM_ARGS, amountUsd: 0.01 })).rejects.toThrow(/Could not verify/)
            expect(mockSignWithdrawalMessage).not.toHaveBeenCalled()
            expect(fetchMock).not.toHaveBeenCalled()
        }
    })
})
