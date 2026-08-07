import { executeClaim, executeClaimXChain } from '../useClaimLink'

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

describe('published claim-link campaign compatibility', () => {
    const originalFetch = global.fetch

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
        mockProvisionSdaTransfer.mockResolvedValue({ sdaAddress: '0xsda' })
    })

    afterEach(() => {
        global.fetch = originalFetch
    })

    it('keeps the ordinary /claim body intact and forwards its opaque campaignTag', async () => {
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
        const mockFetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue({ transactionHash: '0xclaimhash' }),
        })
        global.fetch = mockFetch as typeof fetch

        const result = await executeClaim({
            link: 'https://peanut.me/claim?i=17&campaignTag=devconnect_ba_2025',
            recipientAddress: '0xrecipient',
            depositDetails,
            optimisticReturn: true,
            campaignTag: 'devconnect_ba_2025',
            baseUrl: '/claim',
        })

        expect(result).toBe('0xclaimhash')
        expect(mockFetch).toHaveBeenCalledTimes(1)
        const [url, request] = mockFetch.mock.calls[0]
        expect(url).toBe('/claim')
        expect(request).toMatchObject({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        })
        const body = JSON.parse(String(request.body))
        expect(body).toEqual({
            claimParams: { signature: '0xsigned', recipient: '0xrecipient' },
            chainId: '42161',
            version: 'v4.2',
            depositDetails,
            optimisticReturn: true,
            campaignTag: 'devconnect_ba_2025',
        })
    })

    it('forwards the same opaque campaignTag when the recipient chooses cross-chain settlement', async () => {
        const mockFetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue({ txHash: '0xxchainhash' }),
        })
        global.fetch = mockFetch as typeof fetch

        const result = await executeClaimXChain({
            link: 'https://peanut.me/claim?i=17&campaignTag=devconnect_ba_2025',
            recipientAddress: '0xrecipient',
            destinationChainId: '10',
            destinationToken: '0xusdc',
            campaignTag: 'devconnect_ba_2025',
            baseUrl: '/claim',
        })

        expect(result).toBe('0xxchainhash')
        expect(mockProvisionSdaTransfer).toHaveBeenCalledWith(
            expect.objectContaining({
                destinationAddress: '0xrecipient',
                tokenOut: 'USDC',
            })
        )
        const [url, request] = mockFetch.mock.calls[0]
        expect(url).toBe('/claim')
        expect(JSON.parse(String(request.body))).toEqual({
            claimParams: { signature: '0xsigned', recipient: '0xrecipient' },
            chainId: '42161',
            version: 'v4.2',
            campaignTag: 'devconnect_ba_2025',
        })
    })
})
