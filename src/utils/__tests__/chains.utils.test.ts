import { chains } from '@/constants/chains.consts'
import peanut from '@squirrel-labs/peanut-sdk'
import { getChainProvider } from '../chains.utils'

// mock the chains array
jest.mock('@/constants/chains.consts', () => ({
    chains: [
        {
            id: 1,
            name: 'Ethereum',
            rpcUrls: {
                default: { http: ['https://eth-mainnet.infura.io/v3/your-key'] },
                public: { http: ['https://ethereum-rpc.publicnode.com'] },
            },
        },
    ],
}))

// mock the peanut SDK
jest.mock('@squirrel-labs/peanut-sdk', () => ({
    getDefaultProvider: jest.fn(),
}))

describe('Chain Utilities', () => {
    // mock provider with required methods
    const mockProvider = {
        getNetwork: jest.fn(),
    }

    beforeEach(() => {
        // clear all mocks before each test
        jest.clearAllMocks()
        // reset the mock implementation
        mockProvider.getNetwork.mockReset()
    })

    it('should successfully return provider when Infura RPC works', async () => {
        // setup successful infura response
        mockProvider.getNetwork.mockResolvedValueOnce({ chainId: 1 })
        ;(peanut.getDefaultProvider as jest.Mock).mockResolvedValueOnce(mockProvider)

        const provider = await getChainProvider('1')

        expect(provider).toBe(mockProvider)
        expect(peanut.getDefaultProvider).toHaveBeenCalledWith('1')
        expect(mockProvider.getNetwork).toHaveBeenCalled()
    })

    it('should fall back to public RPC when Infura fails', async () => {
        // setup failed Infura response but successful public RPC
        const failingProvider = {
            getNetwork: jest.fn().mockRejectedValueOnce(new Error('Infura failed')),
        }
        const successfulPublicProvider = {
            getNetwork: jest.fn().mockResolvedValueOnce({ chainId: 1 }),
        }

        // first call fails (Infura), second call succeeds (public RPC)
        ;(peanut.getDefaultProvider as jest.Mock)
            .mockResolvedValueOnce(failingProvider)
            .mockResolvedValueOnce(successfulPublicProvider)

        const provider = await getChainProvider('1')

        expect(provider).toBe(successfulPublicProvider)
        expect(peanut.getDefaultProvider).toHaveBeenCalledTimes(2)
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Default RPC failed for chain 1'))
    })

    it('should throw error when chain is not found', async () => {
        await expect(getChainProvider('999999')).rejects.toThrow('Chain 999999 not found')
    })

    it('should throw error when no public RPC is available', async () => {
        // mock a chain without public RPC
        const chainWithoutPublicRpc = {
            ...chains[0],
            rpcUrls: {
                public: { http: [] },
                default: { http: ['some-url'] },
            },
        }
        jest.spyOn(chains, 'find').mockReturnValueOnce(chainWithoutPublicRpc)

        // setup failed Infura response
        const failingProvider = {
            getNetwork: jest.fn().mockRejectedValueOnce(new Error('Infura failed')),
        }
        ;(peanut.getDefaultProvider as jest.Mock).mockResolvedValueOnce(failingProvider)

        await expect(getChainProvider('1')).rejects.toThrow('No public RPC URL found for chain 1')
    })
})
